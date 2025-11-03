import os
import sqlite3
import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from utils.config import (
    JWT_SECRET,
    JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


class UserAuthService:
    def __init__(self, db_path=None):
        # Production path may be provided via environment variable AUTH_DB_PATH; falls back to local file for dev.
        env_path = os.getenv("AUTH_DB_PATH")
        default_dev_path = os.path.join(os.path.dirname(__file__), "users.db")
        self.db_path = db_path or env_path or default_dev_path
        self._init_db()

    # ---------- Database setup ----------
    def _get_conn(self):
        # Use check_same_thread=False to allow usage across threads (e.g. in async contexts / threaded servers)
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def _init_db(self):
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT,
                    password_hash TEXT,
                    google_id TEXT,
                    auth_provider TEXT DEFAULT 'local',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            # Ensure new columns exist if table was created previously with older schema
            cur.execute("PRAGMA table_info(users)")
            cols = [r[1] for r in cur.fetchall()]
            if "username" not in cols:
                cur.execute("ALTER TABLE users ADD COLUMN username TEXT")
            if "google_id" not in cols:
                cur.execute("ALTER TABLE users ADD COLUMN google_id TEXT")
            if "auth_provider" not in cols:
                cur.execute("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'")
            if "updated_at" not in cols:
                cur.execute("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            conn.commit()
        finally:
            conn.close()

    # ---------- Core user operations ----------
    def register_user(self, email: str, password: str, username: str):
        """Register a new user with username."""
        if not email or not password or not username:
            return False, "Email, password and username required"

        password_hash = generate_password_hash(password)
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            # Enforce unique username manually
            cur.execute("SELECT 1 FROM users WHERE username = ?", (username,))
            if cur.fetchone():
                return False, "Username already taken"
            try:
                cur.execute(
                    "INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)",
                    (email.lower(), password_hash, username),
                )
                conn.commit()
                return True, "User registered successfully"
            except sqlite3.IntegrityError:
                return False, "Email already registered"
        finally:
            conn.close()

    def authenticate(self, email: str, password: str):
        """Authenticate and return access + refresh tokens."""
        if not email or not password:
            return False, "Email and password required"

        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, password_hash, username FROM users WHERE email = ?",
                (email.lower(),),
            )
            row = cur.fetchone()
            if not row:
                return False, "Invalid credentials"

            user_id, password_hash, username = row
            if not check_password_hash(password_hash, password):
                return False, "Invalid credentials"

            access_token = self._create_access_token(user_id, email, username)
            refresh_token = self._create_refresh_token(user_id, email, username)
            return True, {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": {"id": user_id, "email": email, "username": username},
            }
        finally:
            conn.close()

    def delete_user(self, user_id: int):
        """Delete a user by ID."""
        if not user_id:
            return False, "User ID required"
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return False, "Invalid user ID"
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM users WHERE id = ?", (user_id_int,))
            if cur.rowcount == 0:
                return False, "User not found"
            conn.commit()
            return True, "User deleted"
        finally:
            conn.close()

    def list_users(self):
        """Return all users (id, email, username, created_at)."""
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id, email, username, created_at FROM users ORDER BY id ASC")
            rows = cur.fetchall()
            return [
                {
                    "id": r[0],
                    "email": r[1],
                    "username": r[2],
                    "created_at": r[3],
                }
                for r in rows
            ]
        finally:
            conn.close()

    def get_user_by_email(self, email: str):
        if not email:
            return None
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id, email, username, google_id, auth_provider FROM users WHERE email = ?", (email.lower(),))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "email": row[1],
                "username": row[2],
                "google_id": row[3],
                "auth_provider": row[4],
            }
        finally:
            conn.close()

    def get_user_by_google_id(self, google_id: str):
        if not google_id:
            return None
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id, email, username, google_id, auth_provider FROM users WHERE google_id = ?", (google_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "email": row[1],
                "username": row[2],
                "google_id": row[3],
                "auth_provider": row[4],
            }
        finally:
            conn.close()

    def get_user_by_id(self, user_id: int):
        if not user_id:
            return None
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id, email, username, google_id, auth_provider FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "email": row[1],
                "username": row[2],
                "google_id": row[3],
                "auth_provider": row[4],
            }
        finally:
            conn.close()

    def upsert_google_user(self, email: str, google_id: str, username: str):
        """Create a new Google user if not exists; return user dict."""
        # Try by google_id first
        existing = self.get_user_by_google_id(google_id)
        if existing:
            return existing
        # Fallback by email (user may have registered locally earlier)
        by_email = self.get_user_by_email(email)
        if by_email:
            # If existing local user, upgrade with google_id + provider
            conn = self._get_conn()
            try:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE users SET google_id = ?, auth_provider = 'google', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (google_id, by_email["id"]),
                )
                conn.commit()
            finally:
                conn.close()
            return self.get_user_by_email(email)
        # Create new google user (no password)
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO users (email, username, google_id, auth_provider) VALUES (?, ?, ?, 'google')",
                (email.lower(), username, google_id),
            )
            conn.commit()
            cur.execute("SELECT id, email, username, google_id, auth_provider FROM users WHERE google_id = ?", (google_id,))
            row = cur.fetchone()
            return {
                "id": row[0],
                "email": row[1],
                "username": row[2],
                "google_id": row[3],
                "auth_provider": row[4],
            }
        finally:
            conn.close()

    def generate_tokens_for_user(self, user: dict):
        access = self._create_access_token(user["id"], user["email"], user.get("username"))
        refresh = self._create_refresh_token(user["id"], user["email"], user.get("username"))
        return {"access_token": access, "refresh_token": refresh, "token_type": "bearer", "user": user}

    def refresh_tokens(self, refresh_token: str):
        valid, payload = self.verify_token(refresh_token)
        if not valid:
            return False, payload  # error message
        if payload.get("type") != "refresh":
            return False, "Invalid token type"
        user_id = int(payload.get("sub"))
        email = payload.get("email")
        username = payload.get("username")
        user = self.get_user_by_id(user_id)
        if not user:
            return False, "User not found"
        new_access = self._create_access_token(user_id, email, username)
        # Optionally rotate refresh token (simple strategy: always rotate)
        new_refresh = self._create_refresh_token(user_id, email, username)
        return True, {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "user": user,
        }

    # ---------- JWT helper functions ----------
    def _create_access_token(self, user_id: int, email: str, username: str):
        expire = datetime.datetime.now(datetime.timezone.utc)  + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": str(user_id),
            "email": email,
            "username": username,
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def _create_refresh_token(self, user_id: int, email: str, username: str):
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
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return True, payload
        except jwt.ExpiredSignatureError:
            return False, "Token expired"
        except jwt.InvalidTokenError:
            return False, "Invalid token"
