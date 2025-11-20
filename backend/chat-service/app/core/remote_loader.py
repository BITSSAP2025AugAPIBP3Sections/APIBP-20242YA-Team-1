import json
import httpx
from typing import List
from datetime import datetime
from app.models.schema import Vendor, Invoice, VendorDataset

class RemoteVendorDataLoader:
    """Load vendor invoice data from email-storage-service master.json endpoints."""

    def __init__(self, email_base_url: str, user_id: str):
        self.email_base_url = email_base_url.rstrip("/")
        self.user_id = user_id
        self.vendors: List[Vendor] = []

    async def fetch_vendor_list(self) -> List[dict]:
        url = f"{self.email_base_url}/api/v1/drive/users/{self.user_id}/vendors"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            payload = resp.json()
            return payload.get("vendors", [])

    async def fetch_master_records(self, vendor_id: str) -> List[dict]:
        url = f"{self.email_base_url}/api/v1/drive/users/{self.user_id}/vendors/{vendor_id}/master"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
            return data.get("records", []) or []

    async def load_remote(self) -> VendorDataset:
        vendor_entries = await self.fetch_vendor_list()
        vendors: List[Vendor] = []
        for entry in vendor_entries:
            vendor_id = entry.get("id")
            vendor_name = entry.get("name") or "Unknown Vendor"
            if not vendor_id:
                continue
            records = await self.fetch_master_records(vendor_id)
            invoices: List[Invoice] = []
            for r in records:
                # Heuristic mappings
                invoice_number = r.get("invoice_number") or r.get("file_name") or r.get("drive_file_id") or ""
                invoice_date = r.get("invoice_date") or r.get("processed_at", "")
                # Attempt to capture amount from multiple possible keys
                total_amount = (
                    r.get("total_amount")
                    or r.get("amount")
                    or r.get("totalAmount")
                    or r.get("invoice_amount")
                    or r.get("grand_total")
                    or r.get("net_amount")
                    or ""
                )
                # If still blank, attempt heuristic: first value that looks numeric/currency
                if not total_amount:
                    for k, v in r.items():
                        if v and isinstance(v, str) and any(sym in v for sym in ["₹", "$", ","]) or (isinstance(v, (int, float))):
                            # Basic numeric pattern
                            import re
                            s = str(v)
                            cleaned = re.sub(r"[₹$,]", "", s)
                            cleaned = re.sub(r"[^0-9.]", "", cleaned)
                            if cleaned and re.search(r"\d", cleaned):
                                total_amount = v
                                break
                line_items_raw = r.get("line_items", []) or []
                # Normalize line_items to list of dict
                norm_line_items = []
                for li in line_items_raw:
                    if isinstance(li, dict):
                        norm_line_items.append({
                            "item_description": li.get("item_description") or li.get("description") or "",
                            "quantity": li.get("quantity", ""),
                            "unit_price": li.get("unit_price") or li.get("price") or li.get("rate") or "",
                            "amount": li.get("amount") or li.get("line_total") or li.get("total") or "",
                        })
                invoices.append(Invoice(
                    vendor_name=vendor_name,
                    invoice_number=invoice_number,
                    invoice_date=invoice_date,
                    total_amount=total_amount,
                    line_items=norm_line_items,  # type: ignore
                    drive_file_id=r.get("drive_file_id", ""),
                    file_name=r.get("file_name", ""),
                    processed_at=r.get("processed_at", ""),
                    web_view_link=r.get("web_view_link", ""),
                    web_content_link=r.get("web_content_link", "")
                ))
            vendors.append(Vendor(
                vendor_name=vendor_name,
                last_updated=datetime.utcnow().isoformat(),
                invoices=invoices
            ))
        self.vendors = vendors
        return VendorDataset(vendors=vendors)
