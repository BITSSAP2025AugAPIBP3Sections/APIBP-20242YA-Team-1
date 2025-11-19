import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// TODO: Remove mock data
const mockSpendByCategory = [
  { name: "Technology", value: 45200 },
  { name: "Office Supplies", value: 28300 },
  { name: "Services", value: 24800 },
  { name: "Marketing", value: 18900 },
  { name: "Legal", value: 15600 },
];

const mockMonthlyComparison = [
  { name: "Jan", value: 24800 },
  { name: "Feb", value: 26400 },
  { name: "Mar", value: 28200 },
  { name: "Apr", value: 25600 },
  { name: "May", value: 29800 },
  { name: "Jun", value: 31200 },
  { name: "Jul", value: 28400 },
  { name: "Aug", value: 32100 },
  { name: "Sep", value: 29800 },
  { name: "Oct", value: 32450 },
];

const mockTopVendors = [
  { name: "Tech Supplies", value: 42500 },
  { name: "Office Essentials", value: 28300 },
  { name: "Cloud Services", value: 24800 },
  { name: "Marketing", value: 18900 },
  { name: "Legal Services", value: 15600 },
];

const mockQuarterlyTrend = [
  { name: "Q1 2024", value: 79400 },
  { name: "Q2 2024", value: 86600 },
  { name: "Q3 2024", value: 90300 },
  { name: "Q4 2024", value: 94250 },
];

const insights = [
  {
    title: "Highest Spend",
    value: "$42,500",
    icon: TrendingUp,
    change: "Tech Supplies Co",
    changeType: "neutral" as const,
  },
  {
    title: "Average Invoice",
    value: "$2,845",
    icon: DollarSign,
    change: "+5.2% vs last quarter",
    changeType: "positive" as const,
  },
  {
    title: "Cost Reduction",
    value: "8.5%",
    icon: TrendingDown,
    change: "vs previous quarter",
    changeType: "positive" as const,
  },
  {
    title: "Avg Payment Time",
    value: "14 days",
    icon: Calendar,
    change: "-2 days improvement",
    changeType: "positive" as const,
  },
];

export default function Analytics() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Deep insights into your spending patterns
          </p>
        </div>
        <Select defaultValue="year">
          <SelectTrigger className="w-[180px]" data-testid="select-time-period">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {insights.map((insight) => (
          <DashboardMetricCard key={insight.title} {...insight} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsChart
          title="Monthly Spending Trend"
          type="line"
          data={mockMonthlyComparison}
        />
        <AnalyticsChart
          title="Top Vendors by Spend"
          type="bar"
          data={mockTopVendors}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsChart
          title="Spend by Category"
          type="pie"
          data={mockSpendByCategory}
        />
        <AnalyticsChart
          title="Quarterly Growth"
          type="bar"
          data={mockQuarterlyTrend}
        />
      </div>
    </div>
  );
}
