#  Authentication Service

##  Description
The Authentication Service handles user authentication and authorization using two methods:
- Google OAuth2 login
- Email & password–based login and registration

This service issues secure JWT access & refresh tokens and provides user management APIs backed by MongoDB.

---

##  Features
-  Google OAuth2 login
-  Email/password registration & login
-  JWT access & refresh token generation
-  Token rotation & logout
-  User fetch & delete endpoints
-  MongoDB persistence (migrated from SQLite)

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
| MongoDB                 | Database                   |

---

##  Getting Started

###  Navigate to authentication-service directory
cd backend/authentication-service
### Create virtual environment
python -m venv venv
source venv/bin/activate  
### Install dependencies
pip install -r requirements.txt

Ensure a MongoDB instance is running (local or remote). For local quick start using Docker:

```
docker run -d --name auth-mongo -p 27017:27017 mongo:6
```

Or docker compose addition:
```
services:
  mongo:
    image: mongo:6
    restart: always
    ports:
      - "27017:27017"
```

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
| MONGO_URI                   | Mongo connection string               |
| MONGO_DB_NAME               | Mongo database name                   |

Example:
```
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:4001/auth/callback
SECRET_KEY=change_me
JWT_SECRET=change_me_jwt
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
COOKIE_SECURE=False
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=authentication_service
```

Run the Server:
```
python -m src.main
```

The server will start at:
http://localhost:4001
 
Swagger docs at:
http://localhost:4001/docs

---

##  API Endpoints

| Method | Endpoint          | Description                             |
|--------|------------------|-----------------------------------------|
| GET    | /                | Health check                            |
| GET    | /auth/login      | Generate Google OAuth2 consent URL      |
| GET    | /auth/callback   | Handle Google OAuth2 callback           |
| POST   | /register        | Register new user                       |
| POST   | /login           | Login with email & password             |
| POST   | /auth/refresh    | Refresh access token                    |
| POST   | /auth/logout     | Logout user                             |
| GET    | /users           | Fetch all users                         |
| DELETE | /delete-user     | Delete user by ID                       |

---

##  Notes
- Client now treats user IDs as strings (Mongo ObjectId hex). No numeric casting required.
- Unique indexes enforced on email, username, google_id.
- Refresh token rotation implemented on each refresh.




