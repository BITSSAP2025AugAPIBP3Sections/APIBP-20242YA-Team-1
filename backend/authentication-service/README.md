#  Authentication Service

##  Description
The Authentication Service handles user authentication and authorization using two methods:
- Google OAuth2 login
- auth & password–based login and registration

This service issues secure JWT access & refresh tokens and provides user management APIs backed by MongoDB.

---

##  Features
-  Google OAuth2 login
-  auth/password registration & login
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

## Run with Docker (prebuilt image)

- Pull the Docker Image
  - `docker pull gourav094/vendoriq-auth-service:latest`
- Create `.env` from `env.example` and set values safely (do not commit secrets).
- Run the container:
  - `docker run --env-file .env -p 4002:4002 gourav094/vendoriq-auth-service:latest`
- Verify:
  - Open `http://localhost:4002/health`
  - Swagger: `http://localhost:4002/api-docs`

To push any changes and create new image 
- To build the docker image after changes
  - Build `docker build -t gourav094/vendoriq-auth-service:latest .`
  
--- 

## Deploye to K8s
- To start with k8s, we can two ways. One way is using 
  - Docker Desktop Kubernetes: No installation required. Just enable through settings
  - minikube: needs installation

- Using minikube 
  - minikube start (make sure minikube)
  - kubectl get nodes
  - eval $(minikube docker-env) (means using kubernetes CLI) -> verify host `echo $DOCKER_HOST`
  - docker build -t vendoriq-auth-service:latest . (image will be build into kuberenetes)
  - minikube ssh -> docker images | grep vendoriq-auth-service -> after working `exit`
  - Inside your k8s/ folder:
    ``` 
    kubectl apply -f k8s-env.yaml
    kubectl apply -f deployment.yaml
    kubectl apply -f service.yaml 
    ```   
  ! Note: env variables which are declared under secrets, it should be base64 encoded. May use - `echo -n "field_val" | base64
  - Check pods and services
    ```
    kubectl get pods
    kubectl get svc
    kubectl get deploy
    ```
  - Accessing service -> kubectl port-forward svc/auth-service 4001:4001
  - minikube dashboard
  - To check logs `kubectl logs auth-service-6957c58df4-fhvfn`



## Scaling using Docker
- Get service name `kubectl get svc`
- Scale deployement `kubectl scale deployment auth-service --replicas=2`
- kubectl get pods -> now there will be 2 replica for auth-service

- intentionally kill a pod
  - List pod: `kubectl get pods` and pick one like auth-service-57b12
  - Delete it intentionally: kubectl delete pod auth-service-57b12
  - kubectl get pods

-Watch pods in real time: kubectl get pods -w


Note: Create k8s-env.yaml file with environment variable
    

##  API Endpoints

| Method | Endpoint                     | Description                             |
|--------|------------------------------|-----------------------------------------|
| GET    | /                            | Health check                            |
| GET    | /api/v1/auth/google/login    | Generate Google OAuth2 consent URL      |
| GET    | /auth/callback               | Handle Google OAuth2 callback (unversioned) |
| POST   | /api/v1/auth/register        | Register new user                       |
| POST   | /api/v1/auth/login           | Login with auth & password             |
| POST   | /api/v1/auth/refresh         | Refresh access token                    |
| POST   | /api/v1/auth/logout          | Logout user                             |
| GET    | /api/v1/users                | Fetch all users                         |
| DELETE | /api/v1/users/{id}           | Delete user by ID                       |

---

##  Notes
- Client now treats user IDs as strings (Mongo ObjectId hex). No numeric casting required.
- Unique indexes enforced on auth, username, google_id.
- Refresh token rotation implemented on each refresh.




