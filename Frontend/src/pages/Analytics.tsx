<<<<<<< Updated upstream
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
=======
"use client";

import { useEffect, useState, useMemo } from "react";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { TrendingUp, TrendingDown, IndianRupee, Calendar, LucideIcon, BarChart3 } from "lucide-react";
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
interface AnalyticsApiResponse {
  success?: boolean;
  insights: {
    highestSpend: { vendor: string; amount: number };
    averageInvoice: number;
    costReduction: number;
    avgPaymentTime: number;
    totalSpend?: number;
    totalInvoices?: number;
    vendorCount?: number;
  };
  monthlyTrend: { name: string; value: number }[];
  topVendors: { name: string; value: number }[];
  spendByCategory: { name: string; value: number }[];
  quarterlyTrend: { name: string; value: number }[];
  period?: string;
  message?: string;
  cached?: boolean;
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("year");
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [expandedVendors, setExpandedVendors] = useState(false);
  const CHAT_BASE = (import.meta as any).env?.VITE_CHAT_BASE_URL || "http://localhost:4005";

  // Memoized insight cards ALWAYS invoked (safe hook ordering)
  const insights: Insight[] = useMemo(() => {
    const data = analytics;
    if (!data || data.success === false) {
      return [];
    }
    return [
      {
        title: "Highest Spend Vendor",
        value: `₹${data.insights.highestSpend.amount.toLocaleString()}`,
        icon: TrendingUp,
        change: data.insights.highestSpend.vendor,
        changeType: "neutral",
      },
      {
        title: "Average Invoice (INR)",
        value: `₹${data.insights.averageInvoice.toLocaleString()}`,
        icon: IndianRupee,
        changeType: "positive",
      },
      {
        title: "Cost Reduction",
        value: `${data.insights.costReduction.toFixed(1)}%`,
        icon: TrendingDown,
        changeType: "positive",
      },
      {
        title: "Avg Payment Time",
        value: `${data.insights.avgPaymentTime.toFixed(0)} days`,
        icon: Calendar,
        changeType: "positive",
      },
      {
        title: "Total Spend (INR)",
        value: `₹${(data.insights.totalSpend || 0).toLocaleString()}`,
        icon: IndianRupee,
        changeType: "neutral",
      },
      {
        title: "Invoices Indexed",
        value: `${data.insights.totalInvoices || 0}`,
        icon: BarChart3,
        changeType: "neutral",
      },
      {
        title: "Vendors Indexed",
        value: `${data.insights.vendorCount || 0}`,
        icon: BarChart3,
        changeType: "neutral",
      },
    ];
  }, [analytics]);

  useEffect(() => {
    let abort = false;
    setError(null);
    setSlow(false);
    async function fetchData() {
      setLoading(true);
      try {
        // Optionally include userId if available in localStorage for per-user cache
        const userId = localStorage.getItem("userId");
        const url = userId ? `${CHAT_BASE}/api/v1/analytics?period=${period}&userId=${userId}` : `${CHAT_BASE}/api/v1/analytics?period=${period}`;
        const res = await fetch(url);
        const data: AnalyticsApiResponse = await res.json();
        if (!abort) setAnalytics(data);
      } catch (err) {
        if (!abort) {
          console.error("Failed to fetch analytics:", err);
          setError("Failed to load analytics. Please retry.");
          setAnalytics(null);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    const slowTimer = setTimeout(() => { if (!abort) setSlow(true); }, 800);
    fetchData();
    return () => { abort = true; clearTimeout(slowTimer); };
  }, [period, CHAT_BASE]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" />
          <span>{slow ? "Still computing analytics..." : "Loading analytics..."}</span>
        </div>
        {/* Skeleton metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => {
            setPeriod(p => p); // trigger re-fetch by resetting state
            setLoading(true);
            setAnalytics(null);
          }}
          className="px-3 py-1 text-sm rounded border bg-background hover:bg-muted"
        >Retry</button>
      </div>
    );
  }
  if (!analytics) {
    return <p className="text-sm text-muted-foreground">No analytics data yet. Index vendor data first.</p>;
  }
  if (analytics.success === false) {
    return <p className="text-sm text-red-600">{analytics.message || "Analytics unavailable"}</p>;
  }

  // Map API insights to DashboardMetricCard format

  return (
    <div className="space-y-8 max-w-full overflow-x-hidden px-2 md:px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
>>>>>>> Stashed changes
        <div>
          <h1 className="text-4xl font-semibold">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Deep insights into your spending patterns
          </p>
          {analytics.cached && (
            <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 border border-emerald-200" title="Data served from cached snapshot">
              Cached Snapshot
            </span>
          )}
        </div>
        <Select value={period} onValueChange={(val) => setPeriod(val)}>
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

<<<<<<< Updated upstream
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
=======
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 auto-rows-fr">
>>>>>>> Stashed changes
        {insights.map((insight) => (
          <DashboardMetricCard key={insight.title} {...insight} />
        ))}
      </div>

<<<<<<< Updated upstream
      <div className="grid gap-6 lg:grid-cols-2">
=======
      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
>>>>>>> Stashed changes
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

      <div className="grid gap-6 md:grid-cols-2">
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
      {/* Responsive overflow table for long vendor list */}
      {analytics.topVendors?.length > 0 ? (
        <div className="bg-card border rounded-md p-4">
          <h3 className="text-lg font-semibold mb-3">Vendor Spend (All)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-[480px] w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4 font-medium">Vendor</th>
                  <th className="py-2 pr-4 font-medium">Total Spend (INR)</th>
                  <th className="py-2 pr-4 font-medium">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {(expandedVendors ? analytics.topVendors : analytics.topVendors.slice(0, 10)).map(v => (
                  <tr key={v.name} className="border-b last:border-0">
                    <td className="py-2 pr-4 max-w-[180px] truncate" title={v.name}>{v.name}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">₹{v.value.toLocaleString()}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{/* invoice count unknown in this list */}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analytics.topVendors.length > 10 && (
            <button
              className="mt-3 text-xs underline"
              onClick={() => setExpandedVendors(e => !e)}
            >{expandedVendors ? "Show Less" : "Show More"}</button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-md p-4 text-sm text-muted-foreground">No vendor spend data yet.</div>
      )}
    </div>
  );
}
