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
                # Create Invoice from each array item
                invoice = Invoice(
                    vendor_name=invoice_data.get('vendor_name', vendor_name),
                    invoice_number=invoice_data.get('invoice_number', ''),
                    invoice_date=invoice_data.get('invoice_date', ''),
                    total_amount=invoice_data.get('total_amount', ''),
                    line_items=invoice_data.get('line_items', [])
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
                    # This is likely an invoice object
                    invoice = Invoice(
                        vendor_name=value.get('vendor_name', vendor_name),
                        invoice_number=value.get('invoice_number', ''),
                        invoice_date=value.get('invoice_date', ''),
                        total_amount=value.get('total_amount', ''),
                        line_items=value.get('line_items', [])
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
        total_amount = sum(float(invoice.total_amount or 0) for invoice in vendor.invoices if invoice.total_amount)
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
        amount_str = f"${float(invoice.total_amount or 0):.2f}" if invoice.total_amount else "N/A"
        
        # Create a readable line items summary
        line_items_summary = ""
        if invoice.line_items:
            line_items_summary = "\nLine Items:\n"
            for item in invoice.line_items:
                line_items_summary += f"- {item.item_description}: {item.quantity} x ${item.unit_price} = ${item.amount}\n"
        
        content = f"""
        Invoice Details:
        Vendor: {vendor.vendor_name}
        Invoice Number: {invoice.invoice_number}
        Amount: {amount_str}
        Date: {invoice.invoice_date}
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
                "total_amount": invoice.total_amount
            }
        )
