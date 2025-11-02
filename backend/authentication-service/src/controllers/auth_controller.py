from flask import Blueprint, jsonify, redirect, request, session
from services.google_auth_service import GoogleAuthService
import os

auth_bp = Blueprint("auth_bp", __name__)
google_auth_service = GoogleAuthService()

@auth_bp.route("/auth/login", methods=["GET"])
def login():
    auth_url = google_auth_service.get_authorization_url()
    return jsonify({"auth_url": auth_url})

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
