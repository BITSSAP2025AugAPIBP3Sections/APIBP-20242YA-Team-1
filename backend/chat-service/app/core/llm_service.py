from typing import Dict, Any, List, Optional
from app.core.embedder import EmbeddingService
from app.core.retriever import VectorDatabase
from app.core.llm import get_llm_instance

RAG_SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions about vendor invoices. "
    "Use ONLY the provided context chunks. If the answer is not in the context, say you do not have that information. "
    "Be concise and factual."
)

class LLMService:
    def __init__(self, embedding_service: EmbeddingService, vector_db: VectorDatabase):
        self.embedding_service = embedding_service
        self.vector_db = vector_db
        self.llm = get_llm_instance()

    def _format_context(self, docs: List[str], metas: List[dict]) -> str:
        parts = []
        for i, (d, m) in enumerate(zip(docs, metas)):
            tag = m.get("type", "chunk")
            parts.append(f"[Chunk {i+1} | {tag}]\n{d.strip()}\n")
        return "\n".join(parts)
    
    def _build_prompt(self, question: str, sources: List[Dict[str, Any]]) -> Dict[str, str]:
        """Builds a structured system + user prompt using retrieved chunks."""
        if not sources:
            return {
                "system_prompt": "You are VendorIQ, an AI assistant that answers factual questions about vendors.",
                "user_prompt": f"No context found for this question:\n\nQuestion: {question}\n\nAnswer:"
            }

        # Build context from sources
        context_blocks = [
            f"[Source {i+1} | similarity {s.get('similarity', 0):.3f}]\n{s.get('content_excerpt', '')}"
            for i, s in enumerate(sources)
        ]
        context_text = "\n\n".join(context_blocks)

        system_prompt = (
            "You are VendorIQ, an intelligent assistant that provides factual answers "
            "about vendor invoices and related financial data. "
            "Use only the given context. If information is missing, say you don't know. "
            "Be concise and accurate."
        )

        user_prompt = (
            f"Context:\n{context_text}\n\n"
            f"Question: {question}\n\n"
            "Answer:"
        )

        return {"system_prompt": system_prompt, "user_prompt": user_prompt}

    def generate_answer(self, question: str, sources: Optional[List[Dict[str, Any]]] = None, system_prompt_override: Optional[str] = None) -> Dict[str, Any]:
        """Generate an answer given a question and optional retrieved sources.
        sources may be None (e.g. vendor name detection or fallback cases)."""
        try:
            sources = sources or []
            prompts = self._build_prompt(question, sources)
            if system_prompt_override:
                prompts["system_prompt"] = system_prompt_override
            answer = self.llm.generate(prompts["user_prompt"], system=prompts["system_prompt"])
            return {
                "success": True,
                "question": question,
                "answer": answer,
                "sources_used": len(sources)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error generating answer: {str(e)}",
                "answer": "",
                "sources_used": len(sources or [])
            }

    def quick(self, prompt: str, system: Optional[str] = None) -> str:
        """Lightweight wrapper for direct Gemini prompt usage (no RAG formatting)."""
        return self.llm.generate(prompt, system=system)
