from flask import Blueprint, jsonify, redirect, request, session
import os

# Prefer relative imports when executed as package, fallback for direct script execution
try:
    from ..services.google_auth_service import GoogleAuthService
    from ..services.user_auth_service import UserAuthService
except ImportError:
    from services.google_auth_service import GoogleAuthService
    from services.user_auth_service import UserAuthService

auth_bp = Blueprint("auth_bp", __name__)
google_auth_service = GoogleAuthService()
user_auth_service = UserAuthService()

@auth_bp.route("/auth/login", methods=["GET"])
def login():
    auth_url = google_auth_service.get_authorization_url()
    return jsonify({"auth_url": auth_url})

@auth_bp.route("/login", methods=["POST"])
def login_email():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    success, auth_response = user_auth_service.authenticate(email, password)
    if success:
        session["user"] = auth_response.get("user") if isinstance(auth_response, dict) and "user" in auth_response else {"email": email}
        return jsonify(auth_response), 200
    return jsonify({"error": auth_response}), 400

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    username = data.get("username")  # new field
    success, message = user_auth_service.register_user(email, password, username)
    if success:
        # Automatically authenticate to issue tokens
        auth_success, tokens = user_auth_service.authenticate(email, password)
        if auth_success:
            session["user"] = tokens.get("user")
            return jsonify({"tokens": tokens, "email": email}), 201
        # Fallback: registration ok but auth failed unexpectedly
        return jsonify({"message": message, "username": username, "warning": "Registered but auto-login failed"}), 201
    return jsonify({"error": message}), 400

@auth_bp.route("/oauth2callback")
def callback():
    code = request.args.get("code")
    credentials = google_auth_service.exchange_code_for_token(code)

    if not credentials:
        return jsonify({"error": "Invalid credentials"}), 400

    token_info = google_auth_service.verify_token(credentials.id_token)
    if token_info:
        session["user"] = token_info
        return redirect(f"{os.getenv('FRONTEND_URL')}/dashboard")
    else:
        return jsonify({"error": "Invalid token"}), 400

@auth_bp.route("/auth/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"message": "Logged out successfully"})

@auth_bp.route("/delete-user", methods=["DELETE"]) 
def delete_user():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    success, message = user_auth_service.delete_user(user_id)
    if success:
        return jsonify({"message": message}), 200
    return jsonify({"error": message}), 404

@auth_bp.route("/users", methods=["GET"])
def list_users():
    users = user_auth_service.list_users()
    return jsonify({"users": users}), 200
