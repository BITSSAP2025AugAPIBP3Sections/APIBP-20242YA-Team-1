import json
import os
import hashlib
from typing import List, Dict, Any
from datetime import datetime
from app.models.schema import Vendor, Invoice, VendorDataset, KnowledgeChunk

class VendorDataLoader:
    def __init__(self, data_directory: str = "data/vendors"):
        """Initialize the data loader with a directory path for vendor JSON files."""
        self.data_directory = data_directory
        self.vendors_data: List[Vendor] = []
        
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
    
    def _parse_vendor_data(self, data: Dict[str, Any]) -> Vendor:
        """Parse raw JSON data into Vendor model."""
        vendor_name = data.get('vendor_name', '').strip()
        last_updated = data.get('last_updated', datetime.now().isoformat())
        
        invoices:List[Invoice] = []
        # Handle different possible structures in the JSON
        for key, value in data.items():
            if key not in ['vendor_name', 'last_updated'] and isinstance(value, dict):
                # This is likely an invoice object
                invoice = Invoice(
                    invoice_name=value.get('invoice_name', key),
                    invoice_hash=value.get('invoice_hash', ''),
                    invoice_number=value.get('invoice_number', ''),
                    total_amount=float(value.get('total_amount', 0)),
                    date=value.get('date', '')
                )
                invoices.append(invoice)
        
        return Vendor(
            vendor_name=vendor_name,
            last_updated=last_updated,
            invoices=invoices
        )
    
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
        total_amount = sum(invoice.total_amount for invoice in vendor.invoices)
        invoice_count = len(vendor.invoices)
        
        content = f"""
        Vendor: {vendor.vendor_name}
        Last Updated: {vendor.last_updated}
        Total Invoices: {invoice_count}
        Total Amount: ${total_amount:.2f}
        
        This vendor has {invoice_count} invoices with a combined value of ${total_amount:.2f}.
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
                "total_amount": total_amount
            }
        )
    
    def _create_invoice_chunk(self, vendor: Vendor, invoice: Invoice) -> KnowledgeChunk:
        """Create a knowledge chunk for an individual invoice."""
        content = f"""
        Invoice Details:
        Vendor: {vendor.vendor_name}
        Invoice Name: {invoice.invoice_name}
        Invoice Number: {invoice.invoice_number}
        Amount: ${invoice.total_amount:.2f}
        Date: {invoice.date}
        Hash: {invoice.invoice_hash}
        
        This is an invoice from {vendor.vendor_name} for ${invoice.total_amount:.2f} dated {invoice.date}.
        """
        
        chunk_id = hashlib.md5(f"{vendor.vendor_name}_{invoice.invoice_number}".encode()).hexdigest()
        
        return KnowledgeChunk(
            chunk_id=chunk_id,
            vendor_name=vendor.vendor_name,
            content=content.strip(),
            metadata={
                "type": "invoice",
                "vendor_name": vendor.vendor_name,
                "invoice_name": invoice.invoice_name,
                "invoice_number": invoice.invoice_number,
                "invoice_hash": invoice.invoice_hash,
                "total_amount": invoice.total_amount,
                "date": invoice.date
            }
        )
    