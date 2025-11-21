import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

load_dotenv()

logger = logging.getLogger(__name__)

EMAIL_BASE = os.getenv("EMAIL_SERVICE_BASE_URL", "http://localhost:4002")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
OCR_PORT = int(os.getenv("OCR_PORT", "4003"))
OCR_INTERNAL_BASE_URL = os.getenv("OCR_INTERNAL_BASE_URL", f"http://127.0.0.1:{OCR_PORT}")
INVOICES_ROOT = os.getenv("INVOICES_JSON_FOLDER", "invoices_json")
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
CHAT_BASE = os.getenv("CHAT_SERVICE_BASE_URL", "http://localhost:4005/api/v1")


def _ensure_folder(path: str) -> None:
    if not os.path.exists(path):
        os.makedirs(path)


def _build_credentials(scopes: List[str], refresh_token: Optional[str]) -> Optional[Credentials]:
    if not refresh_token:
        logger.error("Refresh token missing; Drive access unavailable")
        return None

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=scopes,
    )

    try:
        creds.refresh(Request())
    except Exception as exc:
        logger.error("Failed to refresh Google credentials", exc_info=exc)
        return None

    return creds


async def _download_pdf(file_id: str, refresh_token: str) -> Optional[bytes]:
    creds = _build_credentials(DRIVE_SCOPES, refresh_token)
    if not creds:
        return None

    url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    headers = {"Authorization": f"Bearer {creds.token}"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                return response.content
            logger.warning("Drive download failed", extra={"file_id": file_id, "status": response.status_code})
        except httpx.HTTPError as exc:
            logger.error("HTTP error downloading from Drive", exc_info=exc, extra={"file_id": file_id})
    return None


async def _run_invoice_ocr(filename: str, content: bytes) -> Optional[Dict]:
    url = f"{OCR_INTERNAL_BASE_URL}/api/v1/invoice/extract"
    files = {"file": (filename, content, "application/pdf")}

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(url, files=files)
            if response.status_code == 200:
                return response.json()
            logger.warning("OCR request failed", extra={"status": response.status_code, "filename": filename})
        except httpx.HTTPError as exc:
            logger.error("HTTP error calling OCR endpoint", exc_info=exc, extra={"filename": filename})
    return None


def _load_master(path: str) -> List[Dict]:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except json.JSONDecodeError:
            logger.warning("Existing master.json invalid JSON", extra={"path": path})
    return []


def _write_master(path: str, payload: List[Dict]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=4)


async def _trigger_knowledge_indexing(user_id: str, incremental: bool = True, refresh_token: str | None = None) -> None:
    """Fire-and-forget call to chat-service to (re)index vendor knowledge after new invoices processed.

    The chat-service endpoint /knowledge/load will pull the remote master.json for the given user
    (already uploaded to Drive) and update embeddings / analytics snapshots. We keep this lightweight
    and non-blocking: failures are logged but do not raise.
    """
    if not user_id:
        return
    url = f"{CHAT_BASE}/knowledge/load"
    params = {"userId": user_id, "incremental": incremental}
    if refresh_token:
        params["refreshToken"] = refresh_token
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, params=params)
        if resp.status_code == 200:
            logger.info("Triggered knowledge indexing", extra={"user_id": user_id, "incremental": incremental})
        else:
            logger.warning(
                "Knowledge indexing trigger failed",
                extra={"user_id": user_id, "status": resp.status_code, "body": resp.text[:300]},
            )
    except Exception as exc:
        logger.error("Knowledge indexing trigger exception", exc_info=exc, extra={"user_id": user_id})


async def _direct_ingest_vendor(user_id: str, vendor_name: str, records: List[Dict], incremental: bool) -> None:
    """Push master records directly to chat-service ingest endpoint for immediate indexing."""
    if not user_id or not vendor_name:
        return
    url = f"{CHAT_BASE}/knowledge/ingest"
    payload = {
        "userId": user_id,
        "incremental": incremental,
        "vendors": [
            {"vendorName": vendor_name, "records": records}
        ]
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            logger.info("Direct ingest success", extra={"vendor": vendor_name, "records": len(records)})
        else:
            logger.warning("Direct ingest failed", extra={"vendor": vendor_name, "status": resp.status_code, "body": resp.text[:300]})
    except Exception as exc:
        logger.error("Direct ingest exception", exc_info=exc, extra={"vendor": vendor_name})


async def _upload_master_to_drive(folder_id: str, local_path: str, refresh_token: str) -> None:
    if not folder_id:
        logger.info("No Drive folder provided for master.json upload")
        return

    creds = _build_credentials(DRIVE_SCOPES, refresh_token)
    if not creds:
        return

    service = build("drive", "v3", credentials=creds)

    query = f"'{folder_id}' in parents and name='master.json' and trashed=false"
    try:
        result = service.files().list(q=query, fields="files(id)").execute()
        for item in result.get("files", []):
            service.files().delete(fileId=item["id"]).execute()
    except Exception as exc:
        logger.error("Failed to remove existing master.json", exc_info=exc, extra={"folder_id": folder_id})

    metadata = {"name": "master.json", "parents": [folder_id]}
    media = MediaFileUpload(local_path, mimetype="application/json")

    try:
        service.files().create(body=metadata, media_body=media, fields="id").execute()
        logger.info("Uploaded master.json to Drive", extra={"folder_id": folder_id})
    except Exception as exc:
        logger.error("Failed to upload master.json", exc_info=exc, extra={"folder_id": folder_id})


async def process_vendor_invoices(
    user_id: str,
    vendor_name: str,
    invoice_folder_id: Optional[str],
    invoices: List[Dict],
    refresh_token: str,
    vendor_folder_id: Optional[str] = None,
) -> Dict:
    if not refresh_token:
        logger.error(
            "Refresh token required for vendor processing",
            extra={"user_id": user_id, "vendor": vendor_name},
        )
        return {
            "userId": user_id,
            "vendorName": vendor_name,
            "invoiceFolderId": invoice_folder_id,
            "processed": [],
            "skipped": [
                {
                    "reason": "missing refresh token",
                    "invoice": None,
                }
            ],
        }
    _ensure_folder(INVOICES_ROOT)

    folder_key = invoice_folder_id or vendor_folder_id or vendor_name or "default"
    local_folder = os.path.join(INVOICES_ROOT, folder_key)
    _ensure_folder(local_folder)

    master_path = os.path.join(local_folder, "master.json")
    master_records = _load_master(master_path)
    master_index = {str(entry.get("drive_file_id")): entry for entry in master_records if entry.get("drive_file_id")}

    processed, skipped = [], []

    for invoice in invoices:
        file_id = str(invoice.get("fileId") or invoice.get("file_id") or invoice.get("id"))
        file_name = invoice.get("fileName") or invoice.get("file_name") or invoice.get("name")
        mime_type = invoice.get("mimeType")
        web_view_link = invoice.get("webViewLink") or invoice.get("web_view_link")
        web_content_link = invoice.get("webContentLink") or invoice.get("web_content_link")

        if not file_id or not file_name:
            skipped.append({"reason": "missing identifiers", "invoice": invoice})
            continue

        if mime_type and mime_type != "application/pdf":
            skipped.append({"reason": "unsupported mime", "invoice": invoice})
            continue

        if file_id in master_index:
            skipped.append({"reason": "already processed", "invoice": invoice})
            continue

        pdf_bytes = await _download_pdf(file_id, refresh_token)
        if not pdf_bytes:
            skipped.append({"reason": "download failed", "invoice": invoice})
            continue

        ocr_payload = await _run_invoice_ocr(file_name, pdf_bytes)
        if not ocr_payload or "error" in ocr_payload:
            skipped.append({"reason": "ocr failed", "invoice": invoice})
            continue

        enriched = dict(ocr_payload)
        enriched.update(
            {
                "drive_file_id": file_id,
                "file_name": file_name,
                "vendor_name": vendor_name,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        if web_view_link:
            enriched["web_view_link"] = web_view_link
        if web_content_link:
            enriched["web_content_link"] = web_content_link

        master_records.append(enriched)
        master_index[file_id] = enriched

        with open(os.path.join(local_folder, f"{file_id}.json"), "w", encoding="utf-8") as handle:
            json.dump(enriched, handle, indent=4)

        processed.append(file_id)

    # Always write master locally first (even if empty) then direct-ingest before Drive upload
    _write_master(master_path, master_records)
    try:
        await _direct_ingest_vendor(user_id=user_id, vendor_name=vendor_name, records=master_records, incremental=bool(processed))
    except Exception as exc:
        logger.error("Direct ingest failed", exc_info=exc, extra={"vendor": vendor_name})

    if processed:
        await _upload_master_to_drive(invoice_folder_id, master_path, refresh_token)
        logger.info(
            "Processed invoices (+direct ingest)",
            extra={"vendor": vendor_name, "processed": len(processed), "skipped": len(skipped)},
        )
    else:
        logger.info(
            "No new invoices to process (direct ingest sent existing master)",
            extra={"vendor": vendor_name, "skipped": len(skipped)},
        )

    return {
        "userId": user_id,
        "vendorName": vendor_name,
        "invoiceFolderId": invoice_folder_id,
        "processed": processed,
        "skipped": skipped,
    }


async def process_all_invoices(user_id: str, refresh_token: str) -> List[Dict]:
    results: List[Dict] = []

    if not refresh_token:
        logger.error("Refresh token required for full sync", extra={"user_id": user_id})
        return results

    async with httpx.AsyncClient(timeout=60.0) as client:
        vendor_resp = await client.get(f"{EMAIL_BASE}/api/v1/drive/users/{user_id}/vendors")
        if vendor_resp.status_code != 200:
            logger.error("Failed to fetch vendor list", extra={"user_id": user_id, "status": vendor_resp.status_code})
            return results

        for vendor in vendor_resp.json().get("vendors", []):
            vendor_folder_id = vendor.get("id")
            vendor_name = vendor.get("name", "Unknown Vendor")

            invoice_resp = await client.get(
                f"{EMAIL_BASE}/api/v1/drive/users/{user_id}/vendors/{vendor_folder_id}/invoices"
            )
            if invoice_resp.status_code != 200:
                logger.error(
                    "Failed to fetch invoices",
                    extra={"user_id": user_id, "vendor_id": vendor_folder_id, "status": invoice_resp.status_code},
                )
                continue

            invoice_payload = invoice_resp.json()
            summary = await process_vendor_invoices(
                user_id=user_id,
                vendor_name=vendor_name,
                invoice_folder_id=invoice_payload.get("invoiceFolderId"),
                invoices=invoice_payload.get("invoices", []),
                vendor_folder_id=vendor_folder_id,
                refresh_token=refresh_token,
            )
            results.append(summary)

    # Full sync no remote indexing trigger; direct ingest handled per vendor.
    logger.info("Full invoice sync complete (direct ingest path)", extra={"user_id": user_id, "vendors": len(results)})

    return results
