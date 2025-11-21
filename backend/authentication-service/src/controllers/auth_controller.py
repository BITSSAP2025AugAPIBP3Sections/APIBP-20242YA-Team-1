"""Authentication Controller
Provides Google OAuth2 and email/password authentication endpoints along with basic user management.
Documentation style aligned with email-storage-service (route, desc, access, consumers, examples, notes).
"""

from flask import Blueprint, jsonify, redirect, request
import os
from dotenv import load_dotenv

load_dotenv()

try:
    from ..services.google_auth_service import GoogleAuthService
    from ..services.user_auth_service import UserAuthService
except ImportError:
    from services.google_auth_service import GoogleAuthService
    from services.user_auth_service import UserAuthService

auth_bp = Blueprint("auth_bp", __name__)
google_auth_service = GoogleAuthService()
user_auth_service = UserAuthService()

@auth_bp.route("/api/v1/auth/google/login", methods=["GET"])
def login():
    """Endpoint: GET /api/v1/auth/google/login
    Purpose: Generate Google OAuth2 consent URL the client should redirect user to.
    Access: Public
    Consumers:
      - Web frontend initiating Google login
      - Mobile / external clients wanting Google OAuth flow
    Returns: JSON { auth_url }
    Flow:
      1. Client requests this endpoint.
      2. Receives auth_url.
      3. Redirect user to auth_url; user consents & Google redirects to /auth/callback.
    Example:
      curl -s http://localhost:4001/api/v1/auth/google/login | jq
    Notes:
      - No authentication required.
      - URL contains scopes defined in GoogleAuthService.
    """
    auth_url = google_auth_service.get_authorization_url()
    return jsonify({"auth_url": auth_url})

@auth_bp.route("/auth/callback")
def callback():
    """Endpoint: GET /auth/callback (UNVERSIONED)
    Purpose: Handle redirect from Google with authorization code; exchange for tokens; set secure cookies; redirect to frontend.
    Access: Public (Google redirects here). Security enforced by opaque one-time code.
    Consumers:
      - Google OAuth redirect only (users should not call manually).
    Returns: Redirect (302) to FRONTEND_URL/ with cookies set OR JSON error.
    Example (manual debug):
      curl -G http://localhost:4001/auth/callback --data-urlencode "code=AUTH_CODE" -v
    Notes:
      - Lives outside /api/v1 for stability of OAuth redirect URI.
      - Sets httpOnly cookies: access_token (1h) & refresh_token (~30d).
    """
    code = request.args.get("code")
    credentials = google_auth_service.exchange_code_for_token(code)
    if not credentials:
        return jsonify({"error": "Invalid credentials"}), 400

    token_info = google_auth_service.verify_token(credentials.id_token)
    if not token_info:
        return jsonify({"error": "Invalid token"}), 400

    email = token_info.get("email")
    google_id = token_info.get("sub")  # Google's unique user ID
    username = token_info.get("name") or token_info.get("given_name") or (email.split("@")[0] if email else None)

    if not email or not google_id:
        return jsonify({"error": "Incomplete token data"}), 400

    user = user_auth_service.upsert_google_user(email, google_id, username)
    tokens = user_auth_service.generate_tokens_for_user(user)
    
    cookie_secure_env = os.getenv("COOKIE_SECURE", "True")  
    cookie_secure = cookie_secure_env.lower() in ("true", "1", "yes") 

    response = redirect(f"{os.getenv('FRONTEND_URL')}/")
    response.set_cookie(
        "access_token",
        tokens["access_token"],
        httponly=True,
        secure=cookie_secure,
        samesite="Lax"
    )
    response.set_cookie(
        "refresh_token",
        tokens["refresh_token"],
        httponly=True,
        secure=cookie_secure,
        samesite="Lax"
    )
    return response


@auth_bp.route("/api/v1/auth/logout", methods=["POST"])
def logout():
    """Endpoint: POST /api/v1/auth/logout
    Purpose: Invalidate current session by clearing auth cookies.
    Access: Authenticated (but will respond success even if cookies absent to simplify client logic).
    Consumers:
      - Frontend logout action.
    Returns: JSON message.
    Example:
      curl -X POST -b "access_token=..." http://localhost:4001/api/v1/auth/logout
    Notes:
      - Stateless; does not blacklist tokens. Client must discard cached tokens.
    """
    response = jsonify({"message": "Logged out successfully"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response

@auth_bp.route("/api/v1/auth/login", methods=["POST"])
def login_email():
    """Endpoint: POST /api/v1/auth/login
    Purpose: Authenticate user via email/password. Issues new access & refresh tokens (cookies).
    Access: Public (credentials required).
    Consumers:
      - Frontend login form.
      - Programmatic clients performing password auth.
    Body: { email: string, password: string }
    Returns: 200 with user summary + cookies OR 400 error.
    Example:
      curl -X POST http://localhost:4001/api/v1/auth/login \
        -H 'Content-Type: application/json' \
        -d '{"email":"user@example.com","password":"secret"}' -i
    Notes:
      - access_token lifetime ~1h; refresh_token ~30d.
      - Cookies are httpOnly (cannot be read by JS) for security.
    """
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    success, auth_response = user_auth_service.authenticate(email, password)
    if not success:
        return jsonify({"error": auth_response}), 400

    tokens = auth_response  # contains access_token, refresh_token, token_type, user
    response = jsonify({
        "user": {
            "id": tokens["user"]["id"],
            "email": email,
            "username": tokens["user"].get("username")
        },
        "message": "Logged in successfully"
    })
    response.set_cookie(
        "access_token",
        tokens["access_token"],
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=3600
    )
    response.set_cookie(
        "refresh_token",
        tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=30 * 24 * 3600
    )
    return response, 200


@auth_bp.route("/api/v1/auth/register", methods=["POST"])
def register():
    """Endpoint: POST /api/v1/auth/register
    Purpose: Create a new user and automatically log them in (issuing cookies) when possible.
    Access: Public.
    Consumers:
      - Registration form.
    Body: { email, password, username }
    Returns: 201 with user + message, possibly tokens; 400 on validation failure.
    Example:
      curl -X POST http://localhost:4001/api/v1/auth/register \
        -H 'Content-Type: application/json' \
        -d '{"email":"new@example.com","password":"secret","username":"newuser"}'
    Notes:
      - Performs uniqueness checks on email.
      - If auto-login fails, user still created.
    """
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    username = data.get("username")

    success, message = user_auth_service.register_user(email, password, username)
    if not success:
        return jsonify({"error": message}), 400

    auth_success, tokens = user_auth_service.authenticate(email, password)
    if not auth_success:
        return jsonify({"message": "Registered successfully, but login failed"}), 201

    response = jsonify({
        "user": {
            "id": tokens["user"]["id"],
            "email": email,
            "username": username
        },
        "message": "Registered successfully"
    })
    response.set_cookie("access_token", tokens["access_token"], httponly=True, secure=True, samesite="Lax", max_age=3600)
    response.set_cookie("refresh_token", tokens["refresh_token"], httponly=True, secure=True, samesite="Lax", max_age=30 * 24 * 3600)
    return response, 201


@auth_bp.route("/api/v1/users/<user_id>", methods=["DELETE"]) 
def delete_user(user_id):
    """Endpoint: DELETE /api/v1/users/{user_id}
    Purpose: Remove a user permanently.
    Access: Admin / privileged context (no enforcement yet – ensure gateway enforces).
    Consumers:
      - Administrative dashboard.
    Returns: 200 success message or 404 error.
    Example:
      curl -X DELETE http://localhost:4001/api/v1/users/USER_ID
    Notes:
      - Irreversible; associated auth tokens become invalid when user missing.
    """
    success, message = user_auth_service.delete_user(user_id)
    if success:
        return jsonify({"message": message}), 200
    return jsonify({"error": message}), 404

@auth_bp.route("/api/v1/users", methods=["GET"])
def list_users():
    """Endpoint: GET /api/v1/users
    Purpose: List all registered users.
    Access: Admin / internal tooling.
    Consumers:
      - Diagnostics or admin panel.
    Returns: { users: [User] }
    Example:
      curl http://localhost:4001/api/v1/users | jq
    Notes:
      - Consider pagination for large datasets (future enhancement).
    """
    users = user_auth_service.list_users()
    return jsonify({"users": users}), 200

@auth_bp.route("/api/v1/auth/refresh", methods=["POST"])
def refresh():
    """Endpoint: POST /api/v1/auth/refresh
    Purpose: Exchange valid refresh_token for new access_token (+ new refresh optionally).
    Access: Requires refresh_token cookie or body value.
    Consumers:
      - Silent token refresh in frontend before access token expiry.
    Body (optional): { refresh_token } if cookie absent.
    Returns: 200 with tokens OR 400/401 errors.
    Example (cookie):
      curl -X POST -b "refresh_token=..." http://localhost:4001/api/v1/auth/refresh
    Example (body):
      curl -X POST http://localhost:4001/api/v1/auth/refresh -H 'Content-Type: application/json' -d '{"refresh_token":"..."}'
    Notes:
      - access_token returned also set as cookie; refresh rotation may occur.
    """
    refresh_token = (
        request.cookies.get("refresh_token")
        or (request.get_json() or {}).get("refresh_token")
    )
    if not refresh_token:
        return jsonify({"error": "Missing refresh token"}), 400
    
    success, result = user_auth_service.refresh_tokens(refresh_token)
    if not success:
        return jsonify({"error": result}), 401
    
    response = jsonify(result)
    response.set_cookie(
        "access_token",
        result["access_token"],
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=3600
    )
    return response, 200

@auth_bp.route("/api/v1/auth/me", methods=["GET"])
def get_current_user():
    """Endpoint: GET /api/v1/auth/me
    Purpose: Retrieve current authenticated user's basic profile using access_token cookie.
    Access: Requires valid access_token cookie; returns unauthenticated shape otherwise.
    Consumers:
      - Frontend session bootstrap.
      - Health checks for auth state.
    Returns: { isAuthenticated: bool, user: { id, username, email } | null }
    Example:
      curl -b "access_token=..." http://localhost:4001/api/v1/auth/me
    Notes:
      - Non-error response even if unauthenticated to simplify client logic.
      - Extendable for roles/permissions later.
    """
    access_token = request.cookies.get("access_token")
    if not access_token:
        return jsonify({"isAuthenticated": False, "user": None}), 200

    valid, payload = user_auth_service.verify_token(access_token)
    if not valid or payload.get("type") != "access":
        return jsonify({"isAuthenticated": False, "user": None}), 200

    user_id = payload.get("sub")
    if not user_id:
        return jsonify({"isAuthenticated": False, "user": None}), 200

    user = user_auth_service.get_user_by_id(user_id)
    if not user:
        return jsonify({"isAuthenticated": False, "user": None}), 200

    return jsonify({
        "isAuthenticated": True,
        "user": {
            "id": user["id"],
            "username": user.get("username"),
            "email": user.get("email"),
        }
    }), 200
