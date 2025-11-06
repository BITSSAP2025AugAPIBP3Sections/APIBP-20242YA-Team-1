from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import asyncio
import httpx
import json
from app.routes import base_routes, pdf_ocr_routes, text_to_json, invoice_routes

# --- Configuration ---
INVOICES_FOLDER = "invoices_pdf"
INVOICES_JSON_FOLDER = os.path.join(INVOICES_FOLDER, "invoices_json")
MASTER_JSON_PATH = os.path.join(INVOICES_JSON_FOLDER, "master.json")

# --- Helper Functions ---
def ensure_folder_exists(folder_path):
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

# --- Background Task ---
async def process_pdfs_in_background():
    """
    Waits for server boot, processes PDFs, saves individual JSONs,
    and appends them to a master JSON file.
    """
    print("⏳ Waiting for server to fully start...")
    await asyncio.sleep(3)
    print("🚀 Starting background PDF processing...")

    ensure_folder_exists(INVOICES_FOLDER)
    ensure_folder_exists(INVOICES_JSON_FOLDER)

    # 1. Load existing master data if available
    master_data = []
    if os.path.exists(MASTER_JSON_PATH):
        try:
            with open(MASTER_JSON_PATH, "r", encoding='utf-8') as f:
                master_data = json.load(f)
        except json.JSONDecodeError:
            print("⚠️ Master JSON corrupted, starting with empty list.")

    async with httpx.AsyncClient(timeout=60.0) as client:
        for filename in os.listdir(INVOICES_FOLDER):
            if filename.endswith(".pdf"):
                pdf_path = os.path.join(INVOICES_FOLDER, filename)
                json_path = os.path.join(INVOICES_JSON_FOLDER, os.path.splitext(filename)[0] + ".json")

                if os.path.exists(json_path):
                    print(f"⏭️  Skipping {filename} (JSON already exists)")
                    continue

                print(f"📂 Processing {filename}...")
                try:
                    with open(pdf_path, "rb") as f:
                        response = await client.post(
                            "http://localhost:8000/api/invoice/extract",
                            files={"file": (filename, f, "application/pdf")}
                        )

                    if response.status_code == 200:
                        invoice_data = response.json()

                        # 2. Save individual JSON file
                        with open(json_path, "w", encoding='utf-8') as json_file:
                            json.dump(invoice_data, json_file, indent=4)

                        # 3. Append to master list and save master.json
                        master_data.append(invoice_data)
                        with open(MASTER_JSON_PATH, "w", encoding='utf-8') as master_file:
                            json.dump(master_data, master_file, indent=4)

                        print(f"✅ Saved {filename} & updated master.json")
                    else:
                        print(f"❌ Failed {filename}: Status {response.status_code} - {response.text}")

                except Exception as e:
                    print(f"⚠️ Error processing {filename}: {e}")

    print("🏁 PDF processing background task completed.")

# --- Lifespan (New Startup/Shutdown Handler) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic ---
    asyncio.create_task(process_pdfs_in_background())
    yield
    # --- Shutdown Logic ---
    pass

# --- App Initialization ---
app = FastAPI(title="Invoice OCR Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router Inclusion ---
app.include_router(base_routes.router)
app.include_router(pdf_ocr_routes.router)
app.include_router(text_to_json.router)
app.include_router(invoice_routes.router)

# --- API Endpoints ---
@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Invoice OCR Service is running"}

if __name__ == "__main__":
    import uvicorn
    ensure_folder_exists(INVOICES_FOLDER)
    uvicorn.run(app, host="0.0.0.0", port=8000)