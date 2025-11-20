from pydantic import BaseModel
from typing import List, Optional

class LineItem(BaseModel):
    item_description: Optional[str] = ""
    quantity: Optional[str] = ""
    unit_price: Optional[str] = ""
    amount: Optional[str] = ""

class Invoice(BaseModel):
    vendor_name: str
    invoice_number: str
    invoice_date: str
    total_amount: Optional[str] = ""
    line_items: List[LineItem] = []
    # Extended metadata fields (optional)
    drive_file_id: Optional[str] = ""
    file_name: Optional[str] = ""
    processed_at: Optional[str] = ""
    web_view_link: Optional[str] = ""
    web_content_link: Optional[str] = ""

class Vendor(BaseModel):
    vendor_name: str
    last_updated: str
    invoices: List[Invoice]

class VendorDataset(BaseModel):
    vendors: List[Vendor]

class KnowledgeChunk(BaseModel):
    chunk_id: str
    vendor_name: str
    content: str
    metadata: dict
    embedding: Optional[List[float]] = None
