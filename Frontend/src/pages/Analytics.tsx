"use client";

import { useEffect, useState } from "react";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { TrendingUp, TrendingDown, DollarSign, Calendar, LucideIcon } from "lucide-react";
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
  insights: {
    highestSpend: { vendor: string; amount: number };
    averageInvoice: number;
    costReduction: number;
    avgPaymentTime: number;
  };
  monthlyTrend: { name: string; value: number }[];
  topVendors: { name: string; value: number }[];
  spendByCategory: { name: string; value: number }[];
  quarterlyTrend: { name: string; value: number }[];
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics"); // API route returning analytics data
        const data: AnalyticsApiResponse = await res.json();
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p>Loading analytics...</p>;
  if (!analytics) return <p>No analytics data available.</p>;

  // Map API insights to DashboardMetricCard format
  const insights: Insight[] = [
    {
      title: "Highest Spend",
      value: `$${analytics.insights.highestSpend.amount.toLocaleString()}`,
      icon: TrendingUp,
      change: analytics.insights.highestSpend.vendor,
      changeType: "neutral",
    },
    {
      title: "Average Invoice",
      value: `$${analytics.insights.averageInvoice.toLocaleString()}`,
      icon: DollarSign,
      changeType: "positive",
    },
    {
      title: "Cost Reduction",
      value: `${analytics.insights.costReduction.toFixed(1)}%`,
      icon: TrendingDown,
      changeType: "positive",
    },
    {
      title: "Avg Payment Time",
      value: `${analytics.insights.avgPaymentTime.toFixed(0)} days`,
      icon: Calendar,
      changeType: "positive",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
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

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {insights.map((insight) => (
          <DashboardMetricCard key={insight.title} {...insight} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsChart
          title="Monthly Spending Trend"
          type="line"
          data={analytics.monthlyTrend}
        />
        <AnalyticsChart
          title="Top Vendors by Spend"
          type="bar"
          data={analytics.topVendors}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsChart
          title="Spend by Category"
          type="pie"
          data={analytics.spendByCategory}
        />
        <AnalyticsChart
          title="Quarterly Growth"
          type="bar"
          data={analytics.quarterlyTrend}
        />
      </div>
    </div>
  );
}
