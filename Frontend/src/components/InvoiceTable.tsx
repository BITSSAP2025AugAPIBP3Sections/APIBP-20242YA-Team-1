import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  date: string;
  amount: string;
  status: "paid" | "pending" | "overdue";
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onViewInvoice?: (id: string) => void;
  onDownloadInvoice?: (id: string) => void;
}

const statusVariants = {
  paid: "default",
  pending: "secondary",
  overdue: "destructive",
} as const;

export function InvoiceTable({
  invoices,
  onViewInvoice,
  onDownloadInvoice,
}: InvoiceTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-medium">Invoice #</TableHead>
            <TableHead className="font-medium">Vendor</TableHead>
            <TableHead className="font-medium">Date</TableHead>
            <TableHead className="font-medium">Amount</TableHead>
            <TableHead className="font-medium">Status</TableHead>
            <TableHead className="font-medium text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
              <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
              <TableCell>{invoice.vendor}</TableCell>
              <TableCell>{invoice.date}</TableCell>
              <TableCell className="font-semibold">{invoice.amount}</TableCell>
              <TableCell>
                <Badge variant={statusVariants[invoice.status]}>
                  {invoice.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewInvoice?.(invoice.id)}
                    data-testid={`button-view-${invoice.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDownloadInvoice?.(invoice.id)}
                    data-testid={`button-download-${invoice.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
