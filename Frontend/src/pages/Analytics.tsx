import { useEffect, useState, useMemo } from "react";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { TrendingUp, TrendingDown, Calendar, IndianRupee, BarChart3, LucideIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Insight {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

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

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 auto-rows-fr">
        {insights.map((insight) => (
          <DashboardMetricCard key={insight.title} {...insight} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <AnalyticsChart title="Monthly Spending Trend" type="line" data={analytics.monthlyTrend || []} />
        <AnalyticsChart title="Top Vendors by Spend" type="bar" data={analytics.topVendors || []} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <AnalyticsChart title="Spend by Category" type="pie" data={analytics.spendByCategory || []} />
        <AnalyticsChart title="Quarterly Growth" type="bar" data={analytics.quarterlyTrend || []} />
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
