from dotenv import load_dotenv
import os

load_dotenv()

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-mpnet-base-v2")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
VECTORDB_PERSIST_DIRECTORY = os.getenv("VECTORDB_PERSIST_DIRECTORY", "data/vectordb")
VENDOR_DATA_DIRECTORY = os.getenv("VENDOR_DATA_DIRECTORY", "sample-data")