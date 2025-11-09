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

##  Environment variables

Create a .env file in the project root and add:

FRONTEND_URL=frontend-app-url

GOOGLE_CLIENT_ID=your-client-id

GOOGLE_CLIENT_SECRET=your-client-secret

GOOGLE_REDIRECT_URI=redirect-uri

SECRET_KEY=flasksecretkey

JWT_SECRET="anytoken"
JWT_ALGORITHM="HS256"

ACCESS_TOKEN_EXPIRE_MINUTES=11

REFRESH_TOKEN_EXPIRE_DAYS=2

COOKIE_SECURE=FALSE if dev else TRUE

Run the Server-
python -m src.main.app

 
The server will start at:
http://localhost:4001
 
Swagger docs at:
http://localhost:4001/docs

---

##  API Endpoints
 
Method	  Endpoint	           Description
GET	      /                 Health check

GET	      /auth/login	      Generate Google OAuth2 consent URL

GET	      /oauth2callback	  Handle Google OAuth2 callback

POST	     /register	        Register new user

POST	     /login	           Login with email & password

POST	    /auth/refresh	     Refresh access token

POST	    /auth/logout	      Logout user

GET	      /users	           Fetch all users

DELETE 	  /delete-user	     Delete user by ID
 


 
