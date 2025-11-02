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
    USER_DB_PATH,
)


class UserAuthService:
    def __init__(self, db_path=None):
        self.db_path = db_path or USER_DB_PATH or os.path.join(os.path.dirname(__file__), "users.db")
        self._init_db()

    # ---------- Database setup ----------
    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            # Add username column if missing (non-destructive)
            cur.execute("PRAGMA table_info(users)")
            cols = [r[1] for r in cur.fetchall()]
            if "username" not in cols:
                cur.execute("ALTER TABLE users ADD COLUMN username TEXT")
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

    # ---------- JWT helper functions ----------
    def _create_access_token(self, user_id: int, email: str, username: str):
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": str(user_id),
            "email": email,
            "username": username,
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def _create_refresh_token(self, user_id: int, email: str, username: str):
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
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
