#  Authentication Service

##  Description
The Authentication Service handles user authentication and authorization using two methods:
- Google OAuth2 login
- Email & password–based login and registration

This service issues secure JWT access & refresh tokens and provides user management APIs.

---

##  Features
-  Google OAuth2 login
-  Email/password registration & login
-  JWT access & refresh token generation
-  Token rotation & logout
-  User fetch & delete endpoints

---

##  Tech Stack

| Component                | Type                       |
|-------------------------|----------------------------|
| Python                  | Programming Language       |
| Flask                   | Web Framework              |
| Flask-Cors              | Flask Extension            |
| google-auth             | Library                    |
| google-auth-oauthlib    | Library                    |
| python-dotenv           | Environment Variables      |
| JWT Tokens              | Authentication Standard    |
| SQLite / MySQL          | Database                   |

---

##  Getting Started

###  Navigate to authentication-service directory
cd backend/authentication-service
### Create virtual environment
python -m venv venv
source venv/bin/activate  
### Install dependencies
pip install -r requirements.txt

---

##  Environment Variables

Create a `.env` file in the project root and add:

| Variable Name                |  Description                         |
|-----------------------------|---------------------------------------|
| FRONTEND_URL                | Frontend application URL              |
| GOOGLE_CLIENT_ID            | Google OAuth client ID                |
| GOOGLE_CLIENT_SECRET        | Google OAuth client secret            |
| GOOGLE_REDIRECT_URI         | OAuth Redirect URI                    |
| SECRET_KEY                  | Flask secret key                      |
| JWT_SECRET                  | JWT signing key                       |
| JWT_ALGORITHM               | Token algorithm (e.g., HS256)         |
| ACCESS_TOKEN_EXPIRE_MINUTES | Access token expiry time              |
| REFRESH_TOKEN_EXPIRE_DAYS   | Refresh token expiry time             |
| COOKIE_SECURE               | TRUE for production, FALSE for dev    |


Run the Server-
python -m src.main.app

 
The server will start at:
http://localhost:4001
 
Swagger docs at:
http://localhost:4001/docs

---

##  API Endpoints

| Method | Endpoint                | Description                             |
|--------|------------------------ |-----------------------------------------|
| GET    | /api/v1/                | Health check                            |
| GET    | /api/v1/auth/login      | Generate Google OAuth2 consent URL      |
| GET    | /api/v1/oauth2callback  | Handle Google OAuth2 callback           |
| POST   | /api/v1/register        | Register new user                       |
| POST   | /api/v1/login           | Login with email & password             |
| POST   | /api/v1/auth/refresh    | Refresh access token                    |
| POST   | /api/v1/auth/logout     | Logout user                             |
| GET    | /api/v1/users           | Fetch all users                         |
| DELETE | /api/v1/delete-user     | Delete user by ID                       |



 
