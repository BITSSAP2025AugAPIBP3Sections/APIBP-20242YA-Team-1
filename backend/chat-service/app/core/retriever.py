import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any
from app.models import KnowledgeChunk

class VectorDatabase:
    def __init__(self, persist_directory: str = "data/vectordb", collection_name: str = "vendor_invoices"):
        """Initialize ChromaDB vector database."""
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.vendor_names = set()  # track distinct vendors
        
        # Initialize ChromaDB client with persistence
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Create or get collection for vendor invoices
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "Vendor invoice knowledge base for VendorIQ"}
        )
        
        print(f"Vector database initialized with collection: {self.collection.name}")
    
    def store_embeddings(self, chunks: List[KnowledgeChunk]) -> bool:
        """Store knowledge chunks with embeddings in the vector database."""
        try:
            # Prepare data for ChromaDB
            ids = []
            embeddings = []
            documents = []
            metadatas = []
            
            for chunk in chunks:
                if chunk.embedding and len(chunk.embedding) > 0:
                    ids.append(chunk.chunk_id)
                    embeddings.append(chunk.embedding)
                    documents.append(chunk.content)
                    
                    # Convert metadata to JSON-serializable format
                    metadata = chunk.metadata.copy()
                    metadata["chunk_id"] = chunk.chunk_id
                    metadata["vendor_name"] = chunk.vendor_name
                    
                    # Convert complex objects to strings for ChromaDB compatibility
                    for key, value in metadata.items():
                        if isinstance(value, (list, dict)):
                            # Convert lists and dicts to JSON strings
                            import json
                            metadata[key] = json.dumps(value)
                        elif value is None:
                            metadata[key] = ""
                        elif not isinstance(value, (str, int, float, bool)):
                            # Convert other types to strings
                            metadata[key] = str(value)
                    
                    metadatas.append(metadata)
                    self.vendor_names.add(chunk.vendor_name)
            
            if not ids:
                print("No valid embeddings to store!")
                return False
            
            # Add to ChromaDB collection
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
            
            print(f"Successfully stored {len(ids)} embeddings in vector database")
            return True
            
        except Exception as e:
            print(f"Error storing embeddings: {str(e)}")
            return False
    
    # Existing generic search retained (internal)
    def search(self, query_embedding: List[float], n_results: int = 5) -> Dict[str, Any]:
        """Search for similar chunks using vector similarity."""
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                include=["documents", "metadatas", "distances"]
            )
            
            return {
                "documents": results["documents"][0] if results["documents"] else [],
                "metadatas": results["metadatas"][0] if results["metadatas"] else [],
                "distances": results["distances"][0] if results["distances"] else []
            }
            
        except Exception as e:
            print(f"Error searching vector database: {str(e)}")
            return {"documents": [], "metadatas": [], "distances": []}
    
    # Added alias expected by orchestrator
    def search_similar(self, query_embedding: List[float], n_results: int = 5) -> Dict[str, Any]:
        return self.search(query_embedding, n_results)

    # Added filtered similarity search by vendor_name
    def search_similar_filtered(self, query_embedding: List[float], vendor_name: str, n_results: int = 5) -> Dict[str, Any]:
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where={"vendor_name": vendor_name},
                include=["documents", "metadatas", "distances"],
            )
            return {
                "documents": results["documents"][0] if results["documents"] else [],
                "metadatas": results["metadatas"][0] if results["metadatas"] else [],
                "distances": results["distances"][0] if results["distances"] else [],
            }
        except Exception as e:
            print(f"Error in filtered search: {e}")
            return {"documents": [], "metadatas": [], "distances": []}

    def search_by_vendor(self, vendor_name: str, n_results: int = 10) -> Dict[str, Any]:
        """Search for chunks by vendor name."""
        try:
            # Avoid query_texts embedding dimension mismatch; just fetch all docs for vendor.
            results = self.collection.get(where={"vendor_name": vendor_name}, include=["documents", "metadatas"])
            documents = results.get("documents", [])
            metadatas = results.get("metadatas", [])
            # Optionally cap to n_results for summary context
            if n_results and n_results > 0:
                documents = documents[:n_results]
                metadatas = metadatas[:n_results]
            return {"documents": documents, "metadatas": metadatas, "distances": []}
        except Exception as e:
            print(f"Error searching by vendor: {str(e)}")
            return {"documents": [], "metadatas": [], "distances": []}


    def list_ids(self) -> List[str]:
        """List all chunk IDs in the collection."""
        try:
            data = self.collection.get(include=[])
            return data.get("ids", [])
        except Exception as e:
            print(f"Error listing ids: {str(e)}")
            return []
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector database collection."""
        try:
            count = self.collection.count()
            return {
                "total_chunks": count,
                "collection_name": self.collection.name
            }
        except Exception as e:
            print(f"Error getting collection stats: {str(e)}")
            return {"total_chunks": 0, "collection_name": "unknown"}
    
    def delete_all(self) -> bool:
        """Delete all data from the collection (for testing/reset)."""
        try:
            self.client.delete_collection(name=self.collection_name)
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "Vendor invoice knowledge base for VendorIQ"}
            )
            print("Successfully cleared vector database")
            return True
        except Exception as e:
            print(f"Error clearing database: {str(e)}")
            return False

    def list_vendors(self) -> List[str]:
        """Return distinct vendor names (cached; falls back to scan metadata)."""
        if self.vendor_names:
            return sorted(self.vendor_names)
        try:
            data = self.collection.get(include=["metadatas"])
            for meta in data.get("metadatas", []):
                if isinstance(meta, dict) and meta.get("vendor_name"):
                    self.vendor_names.add(meta["vendor_name"])
            return sorted(self.vendor_names)
        except Exception as e:
            print(f"Error listing vendors: {e}")
            return []

    def get_all_by_vendor(self, vendor_name: str) -> Dict[str, Any]:
        """Return all documents & metadatas for a vendor (no similarity query)."""
        try:
            results = self.collection.get(where={"vendor_name": vendor_name}, include=["documents", "metadatas"])
            return {
                "documents": results.get("documents", []),
                "metadatas": results.get("metadatas", []),
            }
        except Exception as e:
            print(f"Error getting all by vendor: {e}")
            return {"documents": [], "metadatas": []}

    def get_vendor_spend_totals(self) -> List[Dict[str, Any]]:
        """Aggregate total_amount across all invoice chunks grouped by vendor_name."""
        try:
            data = self.collection.get(include=["metadatas"])
            totals: Dict[str, float] = {}
            invoice_counts: Dict[str, int] = {}
            all_vendors: set[str] = set()
            for meta in data.get("metadatas", []):
                if not isinstance(meta, dict):
                    continue
                vn = meta.get("vendor_name")
                if vn:
                    all_vendors.add(vn)
                if meta.get("type") != "invoice":
                    continue
                vendor = meta.get("vendor_name") or "Unknown"
                raw_amount = meta.get("total_amount")
                amount = 0.0
                def _parse_amount(val):
                    if val is None:
                        return 0.0
                    s = str(val).strip()
                    import re
                    s = re.sub(r"[₹$,]", "", s)
                    s = re.sub(r"[^0-9.]", "", s)
                    try:
                        return float(s) if s else 0.0
                    except Exception:
                        return 0.0
                amount = _parse_amount(raw_amount)
                # Fallback: sum line item amounts if invoice total missing/zero
                if amount == 0.0 and meta.get("line_items"):
                    import json
                    try:
                        line_items = meta.get("line_items")
                        if isinstance(line_items, str):
                            line_items = json.loads(line_items)
                        li_total = 0.0
                        if isinstance(line_items, list):
                            for li in line_items:
                                li_total += _parse_amount(li.get("amount"))
                        if li_total > 0:
                            amount = li_total
                    except Exception:
                        pass
                totals[vendor] = totals.get(vendor, 0.0) + amount
                invoice_counts[vendor] = invoice_counts.get(vendor, 0) + 1
            ranking = [
                {
                    "vendor_name": v,
                    "total_spend": totals[v],
                    "invoice_count": invoice_counts.get(v, 0),
                }
                for v in totals.keys()
            ]
            # Add vendors with zero spend (no invoices indexed yet)
            zero_vendors = [v for v in all_vendors if v not in totals]
            for zv in zero_vendors:
                ranking.append({"vendor_name": zv, "total_spend": 0.0, "invoice_count": 0})
            ranking.sort(key=lambda x: x["total_spend"], reverse=True)
            return ranking
        except Exception as e:
            print(f"Error computing vendor spend totals: {e}")
            return []
