from pydantic import BaseModel
from typing import List, Optional

class Invoice(BaseModel):
    invoice_name: str
    invoice_hash: str
    invoice_number: str
    total_amount: float
    date: str

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
