import json
import os
import hashlib
import re
from typing import List, Dict, Any
from datetime import datetime
from app.models.schema import Vendor, Invoice, VendorDataset, KnowledgeChunk

class VendorDataLoader:
    def __init__(self, data_directory: str = "data/vendors"):
        """Initialize the data loader with a directory path for vendor JSON files."""
        self.data_directory = data_directory
        self.vendors_data: List[Vendor] = []
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        self.email_service_base = os.getenv("EMAIL_STORAGE_SERVICE_URL", "http://localhost:4002/api/v1")
        
    def load_vendor_json_files(self) -> VendorDataset:
        """Load all vendor JSON files from the specified directory."""
        vendors: List[Vendor] = []
        
        if not os.path.exists(self.data_directory):
            print(f"Data directory {self.data_directory} does not exist. Creating it...")
            os.makedirs(self.data_directory, exist_ok=True)
            return VendorDataset(vendors=[])
        
        for filename in os.listdir(self.data_directory):
            if filename.endswith('.json'):
                file_path = os.path.join(self.data_directory, filename)
                try:
                    with open(file_path, 'r') as file:
                        vendor_data = json.load(file)
                        vendor = self._parse_vendor_data(vendor_data)
                        vendors.append(vendor)
                        print(f"Loaded vendor data from {filename}")
                except Exception as e:
                    print(f"Error loading {filename}: {str(e)}")
        
        dataset = VendorDataset(vendors=vendors)
        self.vendors_data = vendors
        return dataset

    def _build_drive_creds(self, refresh_token: str):
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        if not refresh_token or not self.google_client_id or not self.google_client_secret:
            return None
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.google_client_id,
            client_secret=self.google_client_secret,
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )
        try:
            creds.refresh(Request())
            return creds
        except Exception as e:
            print(f"Drive credential refresh failed: {e}")
            return None

    def load_remote_master(self, user_id: str, refresh_token: str) -> VendorDataset:
        """Load vendor data directly from Drive master.json files per vendor folder.

        Flow:
        1. Use email-storage-service to list vendors for user.
        2. For each vendor folder, query Drive for a file named master.json.
        3. Download and parse the master.json (array of invoice objects).
        4. Convert each into a Vendor model.
        Falls back to empty dataset if anything fails silently per vendor.
        """
        import httpx
        from googleapiclient.discovery import build
        vendors: List[Vendor] = []
        if not user_id or not refresh_token:
            return VendorDataset(vendors=[])
        creds = self._build_drive_creds(refresh_token)
        if not creds:
            return VendorDataset(vendors=[])
        # List vendors via email-storage-service
        vendor_list_url = f"{self.email_service_base}/drive/users/{user_id}/vendors"
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(vendor_list_url)
            if resp.status_code != 200:
                print(f"Vendor list fetch failed status={resp.status_code}")
                return VendorDataset(vendors=[])
            service = build("drive", "v3", credentials=creds)
            for v in resp.json().get("vendors", []):
                folder_id = v.get("id")
                v_name = v.get("name") or "Unknown"
                if not folder_id:
                    continue
                # Query for master.json inside folder
                q = f"'{folder_id}' in parents and name='master.json' and trashed=false"
                try:
                    listing = service.files().list(q=q, fields="files(id,name)").execute()
                    files = listing.get("files", [])
                    if not files:
                        continue
                    file_id = files[0]["id"]
                    # Download file content
                    file_content_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
                    import requests
                    headers = {"Authorization": f"Bearer {creds.token}"}
                    r = requests.get(file_content_url, headers=headers, timeout=20)
                    if r.status_code != 200:
                        continue
                    try:
                        payload = r.json()
                    except Exception:
                        continue
                    vendor_model = self._parse_vendor_data(payload)
                    # Ensure vendor name consistent
                    if vendor_model.vendor_name == "Unknown" and v_name:
                        vendor_model.vendor_name = v_name
                    vendors.append(vendor_model)
                except Exception as e:
                    print(f"Failed processing remote master for vendor folder {folder_id}: {e}")
        except Exception as e:
            print(f"Remote vendor listing failed: {e}")
            return VendorDataset(vendors=[])
        return VendorDataset(vendors=vendors)

    def from_raw_vendor_arrays(self, vendors_payload: List[Dict[str, Any]]) -> VendorDataset:
        """Build a VendorDataset from a list of vendor payload objects.

        Expected shape per item:
        {"vendorName": "Acme", "records": [ {...invoice...}, {...} ]}
        Invoice records mirror the master.json array format produced by OCR service.
        """
        vendors: List[Vendor] = []
        for item in vendors_payload:
            records = item.get("records") or []
            vendor_name_override = item.get("vendorName")
            try:
                vendor_model = self._parse_vendor_data(records)
                if vendor_name_override and vendor_model.vendor_name == "Unknown":
                    vendor_model.vendor_name = vendor_name_override
                vendors.append(vendor_model)
            except Exception as e:
                print(f"Failed parsing raw vendor payload: {e}")
        return VendorDataset(vendors=vendors)
    
    def _parse_vendor_data(self, data) -> Vendor:
        """Parse raw JSON data into Vendor model."""
        
        # Handle new array format: array of invoice objects
        if isinstance(data, list):
            if not data:
                return Vendor(vendor_name="Unknown", last_updated=datetime.now().isoformat(), invoices=[])
            
            # Get vendor name from first invoice (assuming all invoices are from same vendor)
            vendor_name = data[0].get('vendor_name', 'Unknown').strip()
            last_updated = datetime.now().isoformat()
            
            invoices: List[Invoice] = []
            for invoice_data in data:
                # Sanitize potentially None fields from OCR / Drive
                inv_vendor = invoice_data.get('vendor_name', vendor_name) or vendor_name
                invoice_number = invoice_data.get('invoice_number') or ''
                invoice_date = invoice_data.get('invoice_date') or ''
                total_amount = invoice_data.get('total_amount') or ''
                raw_line_items = invoice_data.get('line_items') or []
                # Ensure list of dicts
                if not isinstance(raw_line_items, list):
                    raw_line_items = []
                line_items = []
                for li in raw_line_items:
                    if not isinstance(li, dict):
                        continue
                    line_items.append(li)
                invoice = Invoice(
                    vendor_name=inv_vendor,
                    invoice_number=str(invoice_number),
                    invoice_date=str(invoice_date),
                    total_amount=str(total_amount),
                    line_items=line_items
                )
                invoices.append(invoice)
            
            return Vendor(
                vendor_name=vendor_name,
                last_updated=last_updated,
                invoices=invoices
            )
        
        # Handle old vendor object format (for backward compatibility)
        elif isinstance(data, dict):
            vendor_name = data.get('vendor_name', '').strip()
            last_updated = data.get('last_updated', datetime.now().isoformat())
            
            invoices: List[Invoice] = []
            # Handle different possible structures in the JSON
            for key, value in data.items():
                if key not in ['vendor_name', 'last_updated'] and isinstance(value, dict):
                    inv_vendor = value.get('vendor_name', vendor_name) or vendor_name
                    invoice_number = value.get('invoice_number') or ''
                    invoice_date = value.get('invoice_date') or ''
                    total_amount = value.get('total_amount') or ''
                    raw_line_items = value.get('line_items') or []
                    if not isinstance(raw_line_items, list):
                        raw_line_items = []
                    line_items = [li for li in raw_line_items if isinstance(li, dict)]
                    invoice = Invoice(
                        vendor_name=inv_vendor,
                        invoice_number=str(invoice_number),
                        invoice_date=str(invoice_date),
                        total_amount=str(total_amount),
                        line_items=line_items
                    )
                    invoices.append(invoice)
            
            return Vendor(
                vendor_name=vendor_name,
                last_updated=last_updated,
                invoices=invoices
            )
        
        else:
            # Fallback for unexpected format
            return Vendor(vendor_name="Unknown", last_updated=datetime.now().isoformat(), invoices=[])
    
    def convert_to_knowledge_chunks(self, dataset: VendorDataset) -> List[KnowledgeChunk]:
        """Convert vendor dataset to knowledge text chunks for embedding."""
        chunks = []
        
        for vendor in dataset.vendors:
            # Create vendor summary chunk
            vendor_summary = self._create_vendor_summary_chunk(vendor)
            chunks.append(vendor_summary)
            
            # Create individual invoice chunks
            for invoice in vendor.invoices:
                invoice_chunk = self._create_invoice_chunk(vendor, invoice)
                chunks.append(invoice_chunk)
        
        return chunks
    
    def _create_vendor_summary_chunk(self, vendor: Vendor) -> KnowledgeChunk:
        """Create a summary chunk for a vendor."""
        def _parse_amount(val: Any) -> float:
            if val is None:
                return 0.0
            s = str(val).strip()
            # Remove currency symbols, commas, stray spaces
            s = re.sub(r"[₹$,]", "", s)
            # Keep digits and dot only
            s = re.sub(r"[^0-9.]", "", s)
            try:
                return float(s) if s else 0.0
            except Exception:
                return 0.0
        total_amount = sum(_parse_amount(invoice.total_amount) for invoice in vendor.invoices if invoice.total_amount)
        invoice_count = len(vendor.invoices)
        
        content = f"""
        Vendor: {vendor.vendor_name}
        Last Updated: {vendor.last_updated}
        Total Invoices: {invoice_count}
        Total Amount (INR): ₹{total_amount:,.2f}
        
        This vendor has {invoice_count} invoices with a combined value of ₹{total_amount:,.2f}.
        """
        
        chunk_id = hashlib.md5(f"{vendor.vendor_name}_summary".encode()).hexdigest()
        
        return KnowledgeChunk(
            chunk_id=chunk_id,
            vendor_name=vendor.vendor_name,
            content=content.strip(),
            metadata={
                "type": "vendor_summary",
                "vendor_name": vendor.vendor_name,
                "last_updated": vendor.last_updated,
                "invoice_count": invoice_count,
                "total_amount": total_amount  # numeric INR
            }
        )
    
    def _create_invoice_chunk(self, vendor: Vendor, invoice: Invoice) -> KnowledgeChunk:
        """Create a knowledge chunk for an individual invoice."""
        def _parse_amount(val: Any) -> float:
            if val is None:
                return 0.0
            s = str(val).strip()
            s = re.sub(r"[₹$,]", "", s)
            s = re.sub(r"[^0-9.]", "", s)
            try:
                return float(s) if s else 0.0
            except Exception:
                return 0.0
        numeric_amount = _parse_amount(invoice.total_amount)
        amount_str = f"₹{numeric_amount:,.2f}" if invoice.total_amount else "N/A"
        
        # Create a readable line items summary
        line_items_summary = ""
        if invoice.line_items:
            line_items_summary = "\nLine Items (INR):\n"
            for item in invoice.line_items:
                item_amt = _parse_amount(item.amount)
                unit_price_amt = _parse_amount(item.unit_price)
                line_items_summary += f"- {item.item_description}: {item.quantity or ''} x ₹{unit_price_amt:,.2f} = ₹{item_amt:,.2f}\n"
        
        # Include link & file metadata inline so embeddings capture reference context.
        content = f"""
        Invoice Details:
        Vendor: {vendor.vendor_name}
        Invoice Number: {invoice.invoice_number}
        Amount: {amount_str}
        Date: {invoice.invoice_date}
        Drive File ID: {getattr(invoice, 'drive_file_id', '')}
        File Name: {getattr(invoice, 'file_name', '')}
        Processed At: {getattr(invoice, 'processed_at', '')}
        Web View Link: {getattr(invoice, 'web_view_link', '')}
        Web Content Link: {getattr(invoice, 'web_content_link', '')}
        {line_items_summary}
        This is an invoice from {vendor.vendor_name} for {amount_str} dated {invoice.invoice_date}.
        """
        
        chunk_id = hashlib.md5(f"{vendor.vendor_name}_{invoice.invoice_number}".encode()).hexdigest()
        
        # Convert line_items to dictionaries for JSON serialization
        line_items_dict = []
        if invoice.line_items:
            for item in invoice.line_items:
                line_items_dict.append({
                    "item_description": item.item_description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "amount": item.amount
                })
        
        return KnowledgeChunk(
            chunk_id=chunk_id,
            vendor_name=vendor.vendor_name,
            content=content.strip(),
            metadata={
                "type": "invoice",
                "vendor_name": vendor.vendor_name,
                "invoice_number": invoice.invoice_number,
                "invoice_date": invoice.invoice_date,
                "line_items": line_items_dict,  # Use dict instead of LineItem objects
                "total_amount": numeric_amount,  # numeric INR value
                "drive_file_id": getattr(invoice, 'drive_file_id', ''),
                "file_name": getattr(invoice, 'file_name', ''),
                "processed_at": getattr(invoice, 'processed_at', ''),
                "web_view_link": getattr(invoice, 'web_view_link', ''),
                "web_content_link": getattr(invoice, 'web_content_link', ''),
            }
        )
