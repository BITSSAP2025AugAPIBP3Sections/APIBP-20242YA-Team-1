# VendorIQ API Gateway

Central API Gateway for all VendorIQ microservices.

## Run Locally

```bash
npm install
npm start
```

## Run with Docker

```bash
docker build -t api-gateway:latest .
docker run -d --name api-gateway -p 4000:4000 --env-file .env api-gateway:latest
```

## Routes

- `/api/v1/auth/*` → Authentication Service (Port 4002)
- `/api/v1/email/*` → Email Storage Service (Port 4001)
- `/api/v1/ocr/*` → OCR Extraction Service (Port 4003)
- `/api/v1/chat/*` → Chat Service (Port 4005)
- `/api/v1/analytics/*` → Analytics Service (Port 4006)



=======
curl http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"naman","password":"password"}'

 curl http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \                   
  -d '{"email":"user@example.com","password":"password"}'

curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

