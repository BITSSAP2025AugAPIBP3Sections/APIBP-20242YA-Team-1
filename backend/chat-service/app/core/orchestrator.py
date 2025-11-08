from typing import Dict, Any, List, Optional
from app.core.loader import VendorDataLoader
from app.core.embedder import EmbeddingService
from app.core.retriever import VectorDatabase
from app.core.llm_service import LLMService  # added
from app.config import VENDOR_DATA_DIRECTORY, VECTORDB_PERSIST_DIRECTORY


class VendorKnowledgeOrchestrator:
    """Coordinates data loading, embedding generation, vector storage & RAG QA."""
    def __init__(self, data_directory: str = VENDOR_DATA_DIRECTORY, vectordb_directory: str = VECTORDB_PERSIST_DIRECTORY):
        self.data_loader = VendorDataLoader(data_directory)
        self.embedding_service = EmbeddingService()
        self.vector_db = VectorDatabase(vectordb_directory)
        self.llm_service = LLMService(self.embedding_service, self.vector_db)  # added

    def process_vendor_data(self, incremental: bool = False) -> Dict[str, Any]:
        try:
            dataset = self.data_loader.load_vendor_json_files()
            print(f"Loaded {len(dataset.vendors)} vendors")

            if not dataset.vendors:
                return {"success": False, "message": "No vendor data found", "stats": {}}
            # Convert to chunks
            chunks = self.data_loader.convert_to_knowledge_chunks(dataset)
            print(f"Created {len(chunks)} knowledge chunks")

            if incremental:
                existing_ids = set(self.vector_db.list_ids())
                new_chunks = [c for c in chunks if c.chunk_id not in existing_ids]
                skipped = len(chunks) - len(new_chunks)
                print(f"Incremental mode: Found {len(existing_ids)} existing chunks. Skipping {skipped}, processing {len(new_chunks)} new chunks.")
                chunks = new_chunks
            
            embedded_chunks = self.embedding_service.generate_embeddings(chunks)
            successful_embeddings = sum(1 for chunk in embedded_chunks if chunk.embedding)
            print(f"Generated {successful_embeddings}/{len(embedded_chunks)} embeddings")

            print("\nStoring in vector database...")
            storage_success = self.vector_db.store_embeddings(embedded_chunks)
            db_stats = self.vector_db.get_collection_stats()

            return {
                "success": storage_success,
                "message": "Vendor knowledge processing completed successfully!",
                "stats": {
                    "vendors_loaded": len(dataset.vendors),
                    "chunks_created": len(chunks),
                    "embeddings_generated": successful_embeddings,
                    "stored_in_db": db_stats["total_chunks"],
                    "database_collection": db_stats["collection_name"],
                    "incremental": incremental,
                    **({} if not incremental else {"skipped_existing": skipped})
                }
            }
        except Exception as e:
            return {"success": False, "message": f"Error in processing data: {str(e)}", "stats": {}}

    def search_vendor_knowledge(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        try:
            query_embedding = self.embedding_service.generate_single_embedding(query)
            search_results = self.vector_db.search_similar(query_embedding, n_results)

            formatted_results = []
            for i, (doc, metadata, distance) in enumerate(
                zip(search_results["documents"], search_results["metadatas"], search_results["distances"])
            ):
                formatted_results.append(
                    {   
                        "rank": i + 1, 
                        "content": doc, 
                        "metadata": metadata, 
                        "similarity_score": 1 - distance, 
                        "vendor_name": metadata.get("vendor_name", "Unknown")
                    }
                )
            return {
                    "success": True,
                    "query": query,
                    "results": formatted_results,
                    "message": f"Found {len(formatted_results)} relevant results",
                }

        except Exception as e:
            return {"success": False, "message": f"Search error: {str(e)}", "results": []}

    def get_context_for_query(
        self, vendor_name: str, question: str, n_results: int = 5
    ) -> Dict[str, Any]:
        """Retrieve top chunks for a vendor and question for LLM input."""
        try:
            query_emb = self.embedding_service.generate_single_embedding(question)
            retrieval = self.vector_db.search_similar_filtered(
                query_emb, vendor_name, n_results
            )

            sources = []
            for i, (doc, meta, dist) in enumerate(
                zip(retrieval["documents"], retrieval["metadatas"], retrieval["distances"])
            ):
                sources.append(
                    {
                        "rank": i + 1,
                        "chunk_id": meta.get("chunk_id"),
                        "vendor_name": meta.get("vendor_name"),
                        "type": meta.get("type"),
                        "similarity": 1 - dist,
                        "content_excerpt": doc[:220]
                        + ("..." if len(doc) > 220 else ""),
                    }
                )

            context_text = "\n\n".join(
                f"[Source {s['rank']} | sim {s['similarity']:.3f}]\n{s['content_excerpt']}"
                for s in sources
            )

            return {
                "success": True,
                "vendor_name": vendor_name,
                "question": question,
                "context_text": context_text,
                "sources": sources,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error generating context: {e}",
                "sources": [],
                "context_text": "",
            }

    # New answer_query method used by API router
    def answer_query(self, question: str, vendor_name: str | None = None, n_results: int = 5) -> Dict[str, Any]:
        if not vendor_name:
            vendor_name = detect_vendor_name(question, self.vector_db.list_vendors(), self.llm_service)
        if not vendor_name:
            # Fallback: aggregate top chunks across all vendors instead of erroring
            all_vendors = self.vector_db.list_vendors()
            if not all_vendors:
                return {"success": False, "message": "No vendors loaded", "answer": "", "sources": []}
            query_emb = self.embedding_service.generate_single_embedding(question)
            aggregated: List[Dict[str, Any]] = []
            per_vendor_k = max(1, n_results // max(1, len(all_vendors)))
            for v in all_vendors:
                try:
                    retrieval = self.vector_db.search_similar_filtered(query_emb, v, per_vendor_k)
                    for doc, meta, dist in zip(retrieval["documents"], retrieval["metadatas"], retrieval["distances"]):
                        aggregated.append({
                            "rank": 0,  # will set after sorting
                            "chunk_id": meta.get("chunk_id"),
                            "vendor_name": meta.get("vendor_name"),
                            "type": meta.get("type"),
                            "similarity": 1 - dist,
                            "content_excerpt": doc[:220] + ("..." if len(doc) > 220 else ""),
                        })
                except Exception as e:
                    print(f"Retrieval failed for vendor {v}: {e}")
            if not aggregated:
                return {"success": False, "message": "No context retrieved for any vendor", "answer": "", "sources": []}
            aggregated.sort(key=lambda x: x["similarity"], reverse=True)
            sources = aggregated[:n_results]
            for i, s in enumerate(sources):
                s["rank"] = i + 1
            context_text = "\n\n".join(
                f"[Source {s['rank']} | {s['vendor_name']} | sim {s['similarity']:.3f}]\n{s['content_excerpt']}" for s in sources
            )
            rag_response = self.llm_service.generate_answer(question=question, sources=sources)
            return {
                "success": rag_response.get("success", False),
                "vendor_name": None,  # Unknown / multiple
                "question": question,
                "answer": rag_response.get("answer", ""),
                "sources": sources,
                "context_text": context_text,
                "message": rag_response.get("message", "ok"),
                "vendor_detection": "auto-detection failed; aggregated multi-vendor context used"
            }
        try:
            context = self.get_context_for_query(vendor_name=vendor_name, question=question, n_results=n_results)
            if not context.get("success"):
                return {"success": False, "message": context.get("message", "Context retrieval failed"), "answer": "", "sources": []}
            rag_response = self.llm_service.generate_answer(question=question, sources=context.get("sources", []))
            return {
                "success": rag_response.get("success", False),
                "vendor_name": vendor_name,
                "question": question,
                "answer": rag_response.get("answer", ""),
                "sources": context.get("sources", []),
                "context_text": context.get("context_text", ""),
                "message": rag_response.get("message", "ok")
            }
        except Exception as e:
            return {"success": False, "message": f"Answer generation failed: {e}", "answer": "", "sources": []}

    def get_vendor_summary(self, vendor_name: str) -> Dict[str, Any]:
        try:
            results = self.vector_db.search_by_vendor(vendor_name)
            vendor_info = {"vendor_name": vendor_name, "total_chunks": len(results["documents"]), "invoices": [], "summary": {}}
            for doc, metadata in zip(results["documents"], results["metadatas"]):
                if metadata.get("type") == "invoice":
                    vendor_info["invoices"].append({"invoice_number": metadata.get("invoice_number"), "amount": metadata.get("total_amount", 0), "invoice_date": metadata.get("invoice_date")})
                elif metadata.get("type") == "vendor_summary":
                    vendor_info["summary"] = {"last_updated": metadata.get("last_updated"), "total_invoices": metadata.get("invoice_count", 0), "total_amount": metadata.get("total_amount", 0)}
            return {"success": True, "vendor_info": vendor_info}
        except Exception as e:
            return {"success": False, "message": f"Error getting vendor summary: {str(e)}"}

    def get_system_stats(self) -> Dict[str, Any]:
        try:
            db_stats = self.vector_db.get_collection_stats()
            return {"success": True, "stats": db_stats}
        except Exception as e:
            return {"success": False, "message": f"Error getting stats: {str(e)}"}

    def reset_database(self) -> Dict[str, Any]:
        try:
            success = self.vector_db.delete_all()
            return {"success": success, "message": "Database reset successfully" if success else "Failed to reset database"}
        except Exception as e:
            return {"success": False, "message": f"Error resetting database: {str(e)}"}

    def incremental_update(self) -> Dict[str, Any]:
        return self.process_vendor_data(incremental=True)


def detect_vendor_name(query: str, known_vendors: List[str], llm_service: Optional[LLMService] = None) -> Optional[str]:
    query_lower = query.lower()
    for vendor in known_vendors:
        if vendor.lower() in query_lower:
            return vendor
    if llm_service and known_vendors:
        prompt = (
            "Given this user question: '" + query + "'\n"
            + "Which vendor from the following list does it most likely refer to?\n"
            + ", ".join(known_vendors) + "\n"
            + "Return exactly one vendor name from the list or 'None' if unsure."
        )
        try:
            response_text = llm_service.quick(prompt, system="Vendor name disambiguation")
            vendor_guess = response_text.strip()
            for vendor in known_vendors:
                if vendor.lower() in vendor_guess.lower():
                    return vendor
        except Exception as e:
            print(f"LLM vendor detection failed: {e}")
    return None
