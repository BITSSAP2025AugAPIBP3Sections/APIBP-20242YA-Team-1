import os
from dotenv import load_dotenv

load_dotenv()

# Helper functions to enforce presence & type of required environment variables

def _require(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

def _require_int(name: str) -> int:
    raw = _require(name)
    try:
        return int(raw)
    except ValueError:
        raise RuntimeError(f"Environment variable {name} must be an integer, got: {raw!r}")

# Centralized configuration loaded from environment variables (all required)
JWT_SECRET = _require("JWT_SECRET")
JWT_ALGORITHM = _require("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = _require_int("ACCESS_TOKEN_EXPIRE_MINUTES")
REFRESH_TOKEN_EXPIRE_DAYS = _require_int("REFRESH_TOKEN_EXPIRE_DAYS")
USER_DB_PATH = _require("USER_DB_PATH")

__all__ = [
    "JWT_SECRET",
    "JWT_ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "REFRESH_TOKEN_EXPIRE_DAYS",
    "USER_DB_PATH",
]
