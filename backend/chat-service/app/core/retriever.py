import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Optional
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
            results = self.collection.query(
                query_texts=[f"vendor {vendor_name}"],
                n_results=n_results,
                where={"vendor_name": vendor_name},
                include=["documents", "metadatas", "distances"]
            )
            
            return {
                "documents": results["documents"][0] if results["documents"] else [],
                "metadatas": results["metadatas"][0] if results["metadatas"] else [],
                "distances": results["distances"][0] if results["distances"] else []
            }
            
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
