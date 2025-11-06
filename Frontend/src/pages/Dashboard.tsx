import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { InvoiceTable, Invoice } from "@/components/InvoiceTable";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DollarSign, FileText, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

// TODO: Remove mock data
const mockMetrics = [
  {
    title: "Total Spend",
    value: "$124,580",
    icon: DollarSign,
    change: "+12.5% from last month",
    changeType: "positive" as const,
  },
  {
    title: "Total Invoices",
    value: "342",
    icon: FileText,
    change: "+23 this month",
    changeType: "positive" as const,
  },
  {
    title: "Pending Amount",
    value: "$18,240",
    icon: Clock,
    change: "15 invoices",
    changeType: "neutral" as const,
  },
  {
    title: "This Month",
    value: "$32,450",
    icon: TrendingUp,
    change: "+8.2% from average",
    changeType: "positive" as const,
  },
];

const mockRecentInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2025-001",
    vendor: "Tech Supplies Co",
    date: "2025-10-20",
    amount: "$2,450.00",
    status: "paid",
  },
  {
    id: "2",
    invoiceNumber: "INV-2025-002",
    vendor: "Office Essentials",
    date: "2025-10-22",
    amount: "$890.50",
    status: "pending",
  },
  {
    id: "3",
    invoiceNumber: "INV-2025-003",
    vendor: "Cloud Services Inc",
    date: "2025-10-15",
    amount: "$5,200.00",
    status: "paid",
  },
  {
    id: "4",
    invoiceNumber: "INV-2025-004",
    vendor: "Marketing Agency",
    date: "2025-10-10",
    amount: "$3,800.00",
    status: "overdue",
  },
  {
    id: "5",
    invoiceNumber: "INV-2025-005",
    vendor: "Legal Services",
    date: "2025-10-18",
    amount: "$1,500.00",
    status: "pending",
  },
];

const mockSpendByVendor = [
  { name: "Tech Supplies", value: 42500 },
  { name: "Office Essentials", value: 28300 },
  { name: "Cloud Services", value: 24800 },
  { name: "Marketing", value: 18900 },
  { name: "Others", value: 10080 },
];

const mockMonthlyTrend = [
  { name: "Jul", value: 28400 },
  { name: "Aug", value: 31200 },
  { name: "Sep", value: 29800 },
  { name: "Oct", value: 32450 },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome back! Here's your invoice overview
          </p>
        </div>
        <Button variant="outline" data-testid="button-date-range">
          <Calendar className="mr-2 h-4 w-4" />
          Last 30 days
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mockMetrics.map((metric) => (
          <DashboardMetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsChart
          title="Spend by Vendor"
          type="pie"
          data={mockSpendByVendor}
        />
        <AnalyticsChart
          title="Monthly Trend"
          type="line"
          data={mockMonthlyTrend}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Recent Invoices</h2>
          <Button variant="ghost" data-testid="button-view-all">
            View All
          </Button>
        </div>
        <InvoiceTable
          invoices={mockRecentInvoices}
          onViewInvoice={(id) => console.log("View invoice:", id)}
          onDownloadInvoice={(id) => console.log("Download invoice:", id)}
        />
      </div>
    </div>
  );
}
