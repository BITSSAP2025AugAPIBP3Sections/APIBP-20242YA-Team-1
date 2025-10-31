from pydantic import BaseModel
from typing import List, Optional

class LineItem(BaseModel):
    item_description: Optional[str] = ""
    quantity: Optional[str] = ""
    unit_price: Optional[str] = ""
    amount: Optional[str] = ""

class GeminiResponse(BaseModel):
    vendor_name: Optional[str] = ""
    invoice_number: Optional[str] = ""
    invoice_date: Optional[str] = ""
    total_amount: Optional[str] = ""
    line_items: Optional[List[LineItem]] = []
