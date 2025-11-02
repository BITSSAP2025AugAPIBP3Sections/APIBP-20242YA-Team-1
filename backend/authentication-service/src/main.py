from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
import os, sys
from dotenv import load_dotenv

# Ensure local src subpackages (controllers, services, routes) are importable even if run from project root
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from controllers.auth_controller import auth_bp

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.getenv("SECRET_KEY")

app.register_blueprint(auth_bp)

# Swagger configuration
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,  # include all endpoints
            "model_filter": lambda tag: True,  # include all models
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs/"  # <- Swagger UI available at /docs
}

# Build absolute path to swagger yaml to avoid relative path issues after restructuring
swagger_yaml_path = os.path.join(os.path.dirname(__file__), "routes", "swagger_auth_service.yaml")
swagger = Swagger(app, config=swagger_config, template_file=swagger_yaml_path)

@app.route("/")
def home():
    return {"message": "Authentication Service is running!"}, 200

if __name__ == "__main__":  # Run with: python src/main.py
    app.run(host="0.0.0.0", port=4001, debug=True)
