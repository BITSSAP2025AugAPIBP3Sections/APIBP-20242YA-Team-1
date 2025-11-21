import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.services.invoice_processor import process_all_invoices, process_vendor_invoices

router = APIRouter(prefix="/api/v1/processing", tags=["Processing"])

OCR_TRIGGER_TOKEN = os.getenv("OCR_TRIGGER_TOKEN")


class InvoicePayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    fileId: str = Field(..., description="Drive file ID")
    fileName: str = Field(..., description="Original filename")
    mimeType: Optional[str] = Field("application/pdf", description="File MIME type")


class VendorProcessingRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    userId: str = Field(..., description="Internal user identifier")
    vendorName: str = Field(..., description="Display name for vendor")
    vendorFolderId: Optional[str] = Field(None, description="Drive folder ID for the vendor root")
    invoiceFolderId: Optional[str] = Field(None, description="Drive folder ID for the invoices subfolder")
    refreshToken: str = Field(..., description="Google OAuth refresh token for Drive access")
    invoices: List[InvoicePayload] = Field(default_factory=list)


class FullSyncRequest(BaseModel):
    userId: str = Field(..., description="Internal user identifier")
    refreshToken: str = Field(..., description="Google OAuth refresh token for Drive access")


def _validate_token(trigger_header: Optional[str]) -> None:
    if OCR_TRIGGER_TOKEN and trigger_header != OCR_TRIGGER_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid trigger token")


@router.post("/vendor", status_code=status.HTTP_200_OK)
async def process_vendor(
    payload: VendorProcessingRequest,
    trigger_header: Optional[str] = Header(None, alias="x-ocr-token"),
) -> Dict[str, Any]:
    _validate_token(trigger_header)

    if not payload.invoices:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No invoices provided")

    if not payload.refreshToken:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing refresh token")

    summary = await process_vendor_invoices(
        user_id=payload.userId,
        vendor_name=payload.vendorName,
        invoice_folder_id=payload.invoiceFolderId,
        invoices=[invoice.model_dump() for invoice in payload.invoices],
        vendor_folder_id=payload.vendorFolderId,
        refresh_token=payload.refreshToken,
    )
    # Direct ingest now happens inside process_vendor_invoices; no additional knowledge load trigger here.
    return {"status": "processed", "summary": summary}


@router.post("/vendor/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_vendor_invoices(
    payload: FullSyncRequest,
    trigger_header: Optional[str] = Header(None, alias="x-ocr-token"),
) -> Dict[str, Any]:
    _validate_token(trigger_header)

    if not payload.refreshToken:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing refresh token")

    results = await process_all_invoices(user_id=payload.userId, refresh_token=payload.refreshToken)
    return {"status": "processing", "results": results}
