# 🧾 VendorIQ.ai :- Invoice OCR + Gemini Extraction Microservice

This microservice extracts text from vendor invoice PDFs using OCR and converts it into structured JSON using the **Gemini API**.

---

## Tech Stack
- **FastAPI** — Web Framework
- **PDFMiner** — OCR Text Extraction
- **Google Gemini API** — AI-based JSON Conversion
- **Uvicorn** — ASGI Server

---

## 📁 Project Structure
app/
├── routes/ # API routes
├── services/ # Business logic (Gemini, OCR)
├── models/ # Data models (Pydantic)
└── utils/ # Helper functions
        "refreshToken": "<user-drive-refresh-token>",



## 🚀 How to Run

1.  **Create a virtual environment:**
- Each request must include the calling user's Drive refresh token; environment-level tokens are no longer used.
- Processed JSON files are written to `invoices_json/<invoiceFolderId>/` and a vendor-level `master.json` is generated locally and pushed back to Google Drive.
- To fetch the latest vendor/invoice lists and process everything in one shot, call `POST /api/v1/processing/vendor/sync` with `{ "userId": "...", "refreshToken": "..." }`.
    ```
2.  **Activate the virtual environment:**
    * On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```
    * On Windows:
        ```bash
        venv\Scripts\activate
        ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Run the application:**
    ```bash
    uvicorn app.main:app --reload 
    or 
    python -m app.main
    ```
5.  **View API Documentation:**
    Open your browser and go to [http://0.0.0.0:4003/docs](http://0.0.0.0:4003/docs) to see the Swagger UI.

---

## 🔁 Triggering OCR from the Email Service

- Use `POST /api/v1/processing/vendor` to synchronously process the invoices that were just uploaded for a vendor. Provide the Drive metadata captured by the email microservice:

    ```json
    {
        "userId": "<user-id>",
        "vendorName": "Acme Inc",
        "vendorFolderId": "<drive-folder-id>",
        "invoiceFolderId": "<drive-invoice-folder-id>",
        "invoices": [
            { "fileId": "<drive-file-id>", "fileName": "invoice.pdf" }
        ]
    }
    ```

- Optional header `x-ocr-token` must match the `OCR_TRIGGER_TOKEN` env var when set.
- Processed JSON files are written to `invoices_json/<invoiceFolderId>/` and a vendor-level `master.json` is generated locally and pushed back to Google Drive.
- To fetch the latest vendor/invoice lists and process everything in one shot, call `POST /api/v1/processing/vendor/sync` with `{ "userId": "..." }`.




## How to RUN using docker 
- docker build -t ocr-service:latest .
- docker run -d \
  --name ocr-service \
  --env-file .env \
  -p 4003:4003 \
  -v "$(pwd)/invoices_json:/app/invoices_json" \
  -v "$(pwd)/invoices_pdf:/app/invoices_pdf" \
  ocr-service:latest

### to stop the container use 

- docker stop ocr-service && docker rm ocr-service


### to push the service to dockerhub 

- docker login

- docker tag ocr-service:latest <your-dockerhub-username>/ocr-service:latest
- docker tag ocr-service:latest <your-dockerhub-username>/ocr-service:v1.0.0

- docker push <your-dockerhub-username>/ocr-service:latest
- docker push <your-dockerhub-username>/ocr-service:v1.0.0


### after pushing run it form docker hub 


- docker pull <your-dockerhub-username>/ocr-service:latest

- docker run -d \
  --name ocr-service \
  --env-file .env \
  -p 4003:4003 \
  -v "$(pwd)/invoices_json:/app/invoices_json" \
  -v "$(pwd)/invoices_pdf:/app/invoices_pdf" \
  <your-dockerhub-username>/ocr-service:latest


  ## Commands to deploy on minikube

# 1. Start Minikube
minikube start

# 2. Apply the deployment
kubectl apply -f k8s/k8s-deployment.yaml

# 3. Check if pods are running
kubectl get pods -n vendoriq

# 4. Check service
kubectl get svc -n vendoriq

# 5. Get Minikube IP and access the service
minikube service ocr-service -n vendoriq --url

# 6. Or use port-forward to access locally
kubectl port-forward -n vendoriq service/ocr-service 4003:4003

-----------
# View logs
kubectl logs -n vendoriq -l app=ocr-service -f

# Delete deployment
kubectl delete -f k8s/k8s-deployment.yaml

# Stop Minikube
minikube stop

# Delete Minikube cluster
minikube delete
--------------
# Quick One liner Deploy 
minikube start && kubectl apply -f k8s/k8s-deployment.yaml && kubectl port-forward -n vendoriq service/ocr-service 4003:4003

