from typing import List, Optional
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()  # Ensure .env is loaded even if config not imported yet

GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")

class GeminiLLM:
    def __init__(self, model_name: str = GEMINI_MODEL_NAME, temperature: float = 0.7, max_tokens: int = 256):
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.api_key: Optional[str] = None
        self._configure()
        self._load_model()

    def _configure(self):
        # Resolve API key at runtime (after load_dotenv)
        self.api_key = (os.getenv("GEMINI_API_KEY"))
        if not self.api_key:
            available = {k: ("SET" if os.getenv(k) else "NOT SET") for k in ["GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"]}
            raise EnvironmentError(f"Missing Gemini API key. Expected one of GOOGLE_GEMINI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY. Status: {available}")
        genai.configure(api_key=self.api_key)

    def _load_model(self):
        print(f"🔹 Loading Gemini model: {self.model_name} ... (temperature={self.temperature}, max_tokens={self.max_tokens})")
        self.generation_config = {
            "temperature": self.temperature,
            "max_output_tokens": self.max_tokens,
        }
        self.model = genai.GenerativeModel(self.model_name, generation_config=self.generation_config)

    def generate(self, prompt: str, system: Optional[str] = None) -> str:
        # Combine system + user prompt into a single instruction block; Gemini supports system instruction via model.start_chat but here we inline.
        full_prompt = f"System: {system}\nUser: {prompt}" if system else prompt
        try:
            response = self.model.generate_content(full_prompt)
            # Handle safety or empty parts gracefully before accessing response.text
            if hasattr(response, "candidates") and response.candidates:
                for c in response.candidates:
                    # Gemini SDK uses finish_reason (enum) - map known numeric codes
                    fr = getattr(c, "finish_reason", None) or getattr(c, "finishReason", None)
                    # Common finish reasons (approx): 0=STOP,1=MAX_TOKENS,2=SAFETY,3=RECITATION,4=OTHER
                    if fr in (2, "SAFETY") and (not c.content or not getattr(c.content, "parts", [])):
                        return ("Response blocked by safety filters. Please rephrase the question to be strictly factual about vendor invoices/invoice data without requesting disallowed content.")
            if hasattr(response, "text") and response.text:
                return response.text.strip()
            # Fallback: concatenate parts
            if hasattr(response, "candidates"):
                for c in response.candidates:
                    if c.content and c.content.parts:
                        texts = []
                        for p in c.content.parts:
                            if hasattr(p, "text") and p.text:
                                texts.append(p.text)
                        if texts:
                            return "\n".join(t.strip() for t in texts if t).strip()
            return str(response)
        except Exception as e:
            return f"Error generating content: {e}".strip()

    def chat(self, messages: List[dict]) -> str:
        # Build history for Gemini chat if needed; last user message used for response
        system_prompt = next((m["content"] for m in messages if m.get("role") == "system"), "")
        user_messages = [m["content"] for m in messages if m.get("role") == "user"]
        if not user_messages:
            return "No user message provided."
        # For simplicity, merge user messages; could map to chat history parts for richer context.
        user_prompt = "\n".join(user_messages)
        return self.generate(user_prompt, system_prompt)


def get_llm_instance() -> GeminiLLM:
    return GeminiLLM()
