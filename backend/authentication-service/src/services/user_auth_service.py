import os
# Removed sqlite3 import; added pymongo and bson ObjectId
import datetime
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from utils.config import (
    JWT_SECRET,
    JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


class UserAuthService:
    def __init__(self, db_path=None):  # db_path kept for backward compat (unused now)
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGO_DB_NAME", "authentication_service")
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.collection = self.db["users"]
        self._init_indexes()

    # ---------- Database setup (Mongo) ----------
    def _init_indexes(self):
        # Ensure unique indexes for email & username only
        self.collection.create_index("email", unique=True)
        self.collection.create_index("username", unique=True, sparse=True)
        try:
            existing = self.collection.index_information()
            # Drop legacy google_id indexes
            if "google_id_1" in existing:
                self.collection.drop_index("google_id_1")
            if "google_id_unique" in existing and existing["google_id_unique"].get("unique") is not True:
                self.collection.drop_index("google_id_unique")
            # Create unique index on google_id but ONLY for real (string) values; nulls ignored
            self.collection.create_index(
                [("google_id", ASCENDING)],
                name="google_id_unique",
                unique=True,
                partialFilterExpression={"google_id": {"$type": "string"}},
            )
        except Exception as e:
            logger.warning("Failed adjusting google_id index: %s", e)

    # ---------- Core user operations ----------
    def _sanitize_username(self, desired: str):
        # Basic normalization without auto-suffixing
        if not desired:
            return None
        import re
        base = desired.strip().lower()
        base = re.sub(r"\s+", "_", base)
        base = re.sub(r"[^a-z0-9_\-]", "", base)
        return base or None

    def _generate_unique_username(self, desired: str):
        """Generate a unique username based on desired.
        Replaces spaces with underscores, lowercases, strips non-alnum except _ and -.
        Appends numeric suffix if collision detected.
        """
        if not desired:
            desired = "user"
        import re
        base = desired.strip().lower()
        base = re.sub(r"\s+", "_", base)
        base = re.sub(r"[^a-z0-9_\-]", "", base)
        if not base:
            base = "user"
        candidate = base
        counter = 2
        while self.collection.find_one({"username": candidate}):
            candidate = f"{base}-{counter}"
            counter += 1
        return candidate

    def register_user(self, email: str, password: str, username: str):
        if not email or not password or not username:
            return False, "Email, password and username required"
        # Sanitize provided username WITHOUT generating a new one if taken
        desired_username = self._sanitize_username(username)
        if not desired_username:
            return False, "Invalid username"
        # Check for existing username
        if self.collection.find_one({"username": desired_username}):
            return False, "Username already taken"
        password_hash = generate_password_hash(password)
        try:
            self.collection.insert_one({
                "email": email.lower(),
                "username": desired_username,
                "password_hash": password_hash,
                "google_id": None,  # ensure field exists for schema uniformity
                "auth_provider": "local",
                "created_at": datetime.datetime.utcnow(),
                "updated_at": datetime.datetime.utcnow(),
            })
            return True, "User registered successfully"
        except DuplicateKeyError as e:
            # Determine if email or username conflict
            if "email" in str(e):
                return False, "Email already registered"
            if "username" in str(e):
                return False, "Username already taken"
            return False, "Duplicate key error"

    def authenticate(self, email: str, password: str):
        if not email or not password:
            return False, "Email and password required"
        user = self.collection.find_one({"email": email.lower()})
        if not user or not user.get("password_hash") or not check_password_hash(user["password_hash"], password):
            return False, "Invalid credentials"
        user_id = str(user["_id"])  # string ObjectId
        username = user.get("username")
        access_token = self._create_access_token(user_id, email.lower(), username)
        refresh_token = self._create_refresh_token(user_id, email.lower(), username)
        return True, {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {"id": user_id, "email": email.lower(), "username": username},
        }

    def delete_user(self, user_id: str):
        if not user_id:
            return False, "User ID required"
        try:
            oid = ObjectId(user_id)
        except Exception:
            return False, "Invalid user ID"
        result = self.collection.delete_one({"_id": oid})
        if result.deleted_count == 0:
            return False, "User not found"
        return True, "User deleted"

    def list_users(self):
        users = []
        for doc in self.collection.find({}, {"email": 1, "username": 1, "created_at": 1}).sort("_id", ASCENDING):
            users.append({
                "id": str(doc["_id"]),
                "email": doc.get("email"),
                "username": doc.get("username"),
                "created_at": doc.get("created_at"),
            })
        return users

    def get_user_by_email(self, email: str):
        if not email:
            return None
        return self._doc_to_user(self.collection.find_one({"email": email.lower()}))

    def get_user_by_google_id(self, google_id: str):
        if not google_id:
            return None
        return self._doc_to_user(self.collection.find_one({"google_id": google_id}))

    def get_user_by_id(self, user_id: str):
        if not user_id:
            return None
        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        return self._doc_to_user(self.collection.find_one({"_id": oid}))

    def _doc_to_user(self, doc):
        if not doc:
            return None
        return {
            "id": str(doc["_id"]),
            "email": doc.get("email"),
            "username": doc.get("username"),
            "google_id": doc.get("google_id"),
            "auth_provider": doc.get("auth_provider"),
        }

    def upsert_google_user(self, email: str, google_id: str, username: str):
        existing = self.get_user_by_google_id(google_id)
        if existing:
            return existing
        by_email = self.get_user_by_email(email)
        if by_email:
            # Update existing local user with google credentials
            self.collection.update_one(
                {"_id": ObjectId(by_email["id"])},
                {"$set": {"google_id": google_id, "auth_provider": "google", "updated_at": datetime.datetime.utcnow()}},
            )
            return self.get_user_by_email(email)
        # For Google users derive username strictly from email prefix
        email_prefix = (email.split("@")[0] if email else "user")
        # For Google users: base email prefix; if collision we still fall back to unique generation
        base_username = self._sanitize_username(email_prefix) or "user"
        if self.collection.find_one({"username": base_username}):
            # Collision: keep previous behavior of generating unique variant
            username = self._generate_unique_username(base_username)
        else:
            username = base_username
        res = self.collection.insert_one({
            "email": email.lower(),
            "username": username,
            "google_id": google_id,
            "auth_provider": "google",
            "password_hash": None,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow(),
        })
        return self.get_user_by_google_id(google_id)

    def generate_tokens_for_user(self, user: dict):
        access = self._create_access_token(user["id"], user["email"], user.get("username"))
        refresh = self._create_refresh_token(user["id"], user["email"], user.get("username"))
        return {"access_token": access, "refresh_token": refresh, "token_type": "bearer", "user": user}

    def refresh_tokens(self, refresh_token: str):
        valid, payload = self.verify_token(refresh_token)
        if not valid:
            return False, payload
        if payload.get("type") != "refresh":
            return False, "Invalid token type"
        user_id = payload.get("sub")
        email = payload.get("email")
        username = payload.get("username")
        user = self.get_user_by_id(user_id)
        if not user:
            return False, "User not found"
        new_access = self._create_access_token(user_id, email, username)
        new_refresh = self._create_refresh_token(user_id, email, username)
        return True, {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "user": user,
        }

    # ---------- JWT helper functions ----------
    def _create_access_token(self, user_id: str, email: str, username: str):
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": str(user_id),
            "email": email,
            "username": username,
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def _create_refresh_token(self, user_id: str, email: str, username: str):
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        payload = {
            "sub": str(user_id),
            "email": email,
            "username": username,
            "exp": expire,
            "type": "refresh",
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def verify_token(self, token: str):
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return True, payload
        except jwt.ExpiredSignatureError:
            return False, "Token expired"
        except jwt.InvalidTokenError:
            return False, "Invalid token"
