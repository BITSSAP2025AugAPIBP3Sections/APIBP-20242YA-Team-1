import os
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from google.auth.transport import requests
from dotenv import load_dotenv

load_dotenv()

class GoogleAuthService:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        # Ensure redirect_uri uses /api/v1/oauth2callback by default
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:4001/api/v1/oauth2callback")

        service_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(service_dir, "..", ".."))
        client_secret_path = os.path.join(root_dir, "client_secret.json")

        if not os.path.exists(client_secret_path):
            raise FileNotFoundError(f"client_secret.json not found at: {client_secret_path}")

        self.flow = Flow.from_client_secrets_file(
            client_secret_path,
            scopes=[
                "https://www.googleapis.com/auth/userinfo.profile",
                "https://www.googleapis.com/auth/userinfo.email",
                "openid",
            ],
            redirect_uri=self.redirect_uri,
        )

    def get_authorization_url(self):
        print("Using redirect URI:", self.flow.redirect_uri)
        auth_url, _ = self.flow.authorization_url(prompt="consent")
        return auth_url

    def exchange_code_for_token(self, code):
        self.flow.fetch_token(code=code)
        credentials = self.flow.credentials
        return credentials

    def verify_token(self, token):
        try:
            idinfo = id_token.verify_oauth2_token(token, requests.Request(), self.client_id)
            return idinfo
        except Exception as e:
            print("Token verification failed:", e)
            return None
