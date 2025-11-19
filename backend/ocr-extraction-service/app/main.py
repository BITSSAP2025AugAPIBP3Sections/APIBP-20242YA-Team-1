import os
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
import httpx
from dotenv import load_dotenv

# Import routers
from app.routes import base_routes, pdf_ocr_routes, text_to_json, invoice_routes

# Load env vars
load_dotenv()

EMAIL_BASE = os.getenv("EMAIL_SERVICE_BASE_URL", "http://localhost:4002")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
OCR_PORT = int(os.getenv("OCR_PORT"))
user_id = os.getenv("USER_ID")
INVOICES_JSON_FOLDER = "invoices_json"
MASTER_JSON_PATH = os.path.join(INVOICES_JSON_FOLDER, "master.json")


# -------------------------------------------------------------------------------------
#               DOWNLOAD PDF FROM GOOGLE DRIVE USING AUTHENTICATION
# -------------------------------------------------------------------------------------
async def download_pdf_from_drive_api(file_id: str):
    """Download PDF from Google Drive using Drive API."""

    creds = Credentials(
        token=None,
        refresh_token=GOOGLE_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )

    try:
        creds.refresh(Request())
        print("Access token refreshed for PDF download")
    except Exception as e:
        print("Failed to refresh token during PDF download")
        return None

    url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    headers = {"Authorization": f"Bearer {creds.token}"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.get(url, headers=headers)

        if res.status_code == 200:
            print("PDF downloaded from Drive")
            return res.content

        print("Drive API download failed")
        return None


# -------------------------------------------------------------------------------------
#               DELETE OLD master.json BEFORE UPLOADING NEW ONE
# -------------------------------------------------------------------------------------
def delete_existing_master_json(service, folder_id: str):
    """Delete any existing master.json file in Drive folder."""

    query = f"'{folder_id}' in parents and name='master.json' and trashed=false"
    result = service.files().list(q=query, fields="files(id)").execute()

    for f in result.get("files", []):
        service.files().delete(fileId=f["id"]).execute()
        print("Old master.json deleted")


# -------------------------------------------------------------------------------------
#                         UPLOAD master.json TO GOOGLE DRIVE
# -------------------------------------------------------------------------------------
async def upload_to_drive(folder_id: str, file_path: str, filename: str):
    """Upload JSON to Google Drive using refresh token."""

    if not GOOGLE_REFRESH_TOKEN:
        print("Upload skipped: Missing refresh token")
        return

    creds = Credentials(
        token=None,
        refresh_token=GOOGLE_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=["https://www.googleapis.com/auth/drive.file"]
    )

    try:
        creds.refresh(Request())
        print("Access token refreshed for upload")
    except Exception:
        print("Invalid refresh token. Upload skipped.")
        return

    service = build("drive", "v3", credentials=creds)

    delete_existing_master_json(service, folder_id)

    metadata = {"name": filename, "parents": [folder_id]}
    media = MediaFileUpload(file_path, mimetype="application/json")

    uploaded = service.files().create(
        body=metadata, media_body=media, fields="id"
    ).execute()

    print("master.json uploaded")


# -------------------------------------------------------------------------------------
#                               HELPERS
# -------------------------------------------------------------------------------------
def ensure_folder_exists(path: str):
    if not os.path.exists(path):
        os.makedirs(path)


# -------------------------------------------------------------------------------------
#                           BACKGROUND WORKER
# -------------------------------------------------------------------------------------
async def process_pdfs(user_id: str):

    print("Waiting for server startup")
    await asyncio.sleep(3)
    print("Starting invoice processing")

    ensure_folder_exists(INVOICES_JSON_FOLDER)
    master_data = []

    async with httpx.AsyncClient(timeout=60.0) as client:

        # Fetch vendor list
        vendor_resp = await client.get(f"{EMAIL_BASE}/api/v1/drive/users/{user_id}/vendors")
        vendor_data = vendor_resp.json()

        if not vendor_data.get("vendors"):
            print("No vendors found")
            return

        vendor_id = vendor_data["vendors"][0]["id"]
        print("Vendor identified")

        # Fetch invoice list
        invoice_resp = await client.get(
            f"{EMAIL_BASE}/api/v1/drive/users/{user_id}/vendors/{vendor_id}/invoices"
        )
        invoice_data = invoice_resp.json()

        invoice_folder_id = invoice_data.get("invoiceFolderId")
        all_files = invoice_data.get("invoices", [])

        invoices = [f for f in all_files if f.get("mimeType") == "application/pdf"]

        if not invoices:
            print("No PDF invoices found")
            return

        print(f"{len(invoices)} invoice(s) detected")

        for invoice in invoices:
            file_id = invoice["id"]
            filename = invoice["name"]

            json_path = os.path.join(INVOICES_JSON_FOLDER, f"{file_id}.json")


            print("Downloading PDF")
            content = await download_pdf_from_drive_api(file_id)

            if not content:
                print("Failed to download PDF")
                continue

            # OCR extraction
            ocr_resp = await client.post(
                "http://localhost:4003/api/v1/invoice/extract",
                files={"file": (filename, content, "application/pdf")}
            )

            if ocr_resp.status_code != 200:
                print("OCR failed for invoice")
                continue

            invoice_json = ocr_resp.json()

            with open(json_path, "w") as f:
                json.dump(invoice_json, f, indent=4)

            master_data.append(invoice_json)
            print("OCR completed for invoice")

        # Store master.json
        with open(MASTER_JSON_PATH, "w") as f:
            json.dump(master_data, f, indent=4)

        print("master.json created locally")

        # Upload to Drive
        await upload_to_drive(invoice_folder_id, MASTER_JSON_PATH, "master.json")

        print("Invoice processing finished")


# -------------------------------------------------------------------------------------
#                               FASTAPI SETUP
# -------------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(process_pdfs(user_id))
    yield


app = FastAPI(title="Invoice OCR Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_VERSION = "/api/v1"
app.include_router(base_routes.router, prefix=API_VERSION)
app.include_router(pdf_ocr_routes.router, prefix=API_VERSION)
app.include_router(text_to_json.router, prefix=API_VERSION)
app.include_router(invoice_routes.router, prefix=API_VERSION)


@app.get("/")
def root():
    return {"message": "OCR Service Running"}


if __name__ == "__main__":
    import uvicorn
    ensure_folder_exists(INVOICES_JSON_FOLDER)
    uvicorn.run(app, host="0.0.0.0", port=OCR_PORT)
