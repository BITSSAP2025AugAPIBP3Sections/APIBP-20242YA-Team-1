from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
from controllers.auth_controller import auth_bp
import os
from dotenv import load_dotenv

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

# Load external Swagger YAML
swagger = Swagger(app, config=swagger_config, template_file="../routes/swagger_auth_service.yaml")

@app.route("/")
def home():
    return {"message": "Authentication Service is running!"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
