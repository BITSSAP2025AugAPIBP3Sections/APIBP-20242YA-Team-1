from typing import List
from app.models import KnowledgeChunk
from sentence_transformers import SentenceTransformer

class EmbeddingService:
    def __init__(self, model_name: str = "sentence-transformers/all-mpnet-base-v2"):
        self.embedding_model = model_name
        self.model = SentenceTransformer(model_name)
    
    def generate_embeddings(self, chunks: List[KnowledgeChunk]) -> List[KnowledgeChunk]:
        texts = [c.content for c in chunks]
        vectors = self.model.encode(texts, batch_size=16, show_progress_bar=False).tolist()
        for c, v in zip(chunks, vectors):
            c.embedding = v
        return chunks
    
    def generate_single_embedding(self, text: str) -> List[float]:
        return self.model.encode([text])[0].tolist()
    
    def get_embedding_dimension(self) -> int:
        return len(self.generate_single_embedding("dimension probe"))