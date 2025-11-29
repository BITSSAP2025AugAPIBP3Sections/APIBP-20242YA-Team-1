import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { TrendingUp, TrendingDown, Calendar, IndianRupee, BarChart3, LucideIcon, Mail, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalytics } from "@/hooks/use-analytics";

interface Insight {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export default function Analytics() {
  const [period, setPeriod] = useState("year");
  const [expandedVendors, setExpandedVendors] = useState(false);
  const queryClient = useQueryClient();
  
  // Use React Query hook for analytics data
  const { data: analytics, isLoading, isError, error, isFetching, dataUpdatedAt } = useAnalytics(period);

  // Memoized insight cards
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

  // Handle manual sync
  const handleSync = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics", period] });
  };

  // Format last sync time
  const formatLastSync = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-full border-4 border-t-transparent animate-spin mb-4" style={{ borderColor: '#e5e7eb' }} />
          <h2 className="text-2xl font-bold text-muted-foreground">
            Loading your analytics data...
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-xl">
            This may take a few moments if you have a large number of invoices or vendors. Please wait while we gather your insights.
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-muted-foreground">No analytics data available</h2>
          <p className="text-lg text-muted-foreground text-center max-w-xl">
            We couldn't find any analytics for your connected account yet.<br />
            Please sync your mail or connect your Gmail account.<br />
            Go to <strong>Settings</strong> to check the status and sync your data.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-800 text-sm max-w-md">
            <strong>Tip:</strong> After connecting your email, make sure to sync to see your latest analytics. If you face issues, retry syncing or check your connection status in Settings.
          </div>
          <Button onClick={handleSync} variant="outline" size="lg">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-muted-foreground">No analytics data available</h2>
          <p className="text-lg text-muted-foreground text-center max-w-xl">
            We couldn't find any analytics for your connected account yet.<br />
            Please sync your mail or connect your <Mail className="inline w-5 h-5 align-text-bottom text-red-500" aria-label="Gmail" /> account.<br />
            <Button onClick={() => window.location.href = '/settings'} variant="outline" size="lg">
                <Mail className="h-4 w-4 mr-2 text-red-500" />
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Settings
              </Button>
            to check the status and sync your data.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-800 text-sm max-w-md">
            <strong>Tip:</strong> After connecting your email, make sure to sync to see your latest analytics. If you face issues, retry syncing or check your connection status in Settings.
          </div>
        </div>
      </div>
    );
  }

  if (analytics.success === false) {
    return <p className="text-sm text-red-600">{analytics.message || "Analytics unavailable"}</p>;
  }

  return (
    <div className="space-y-8 max-w-full overflow-x-hidden px-2 md:px-4">
      {/* Header */}
      <div className="flex flex-col md:items- md:justify-between gap-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold">Analytics</h1>
            <p className="mt-2 text-muted-foreground text-xs md:text-sm">
              Deep insights into your spending patterns
            </p>
            {dataUpdatedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced: {formatLastSync(dataUpdatedAt)}
              {isFetching && <span className="ml-2 text-blue-600">• Updating...</span>}
            </p>
            )}
          </div>
          <div className="flex gap-2  ">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? "Syncing..." : "Sync"}
          </Button>
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
          
        </div>
        {analytics.llmSummary && (
            <div className="mt-3 text-sm leading-relaxed bg-muted/40 p-3 rounded-lg border">
              <strong className="block mb-1">AI Summary:</strong>
              <span>{analytics.llmSummary}</span>
            </div>
          )}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
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
