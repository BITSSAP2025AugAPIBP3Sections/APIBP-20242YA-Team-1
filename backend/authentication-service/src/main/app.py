from flask import Flask
from flask_cors import CORS
from controllers.auth_controller import auth_bp
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.getenv("SECRET_KEY")

app.register_blueprint(auth_bp)

@app.route("/")
def home():
    return {"message": "Authentication Service is running!"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
