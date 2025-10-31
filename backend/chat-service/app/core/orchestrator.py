from typing import Dict, Any
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
