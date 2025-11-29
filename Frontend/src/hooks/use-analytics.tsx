import { useQuery } from "@tanstack/react-query";

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
  llmSummary?: string;
}

const CHAT_BASE = (import.meta as any).env?.VITE_CHAT_BASE_URL || "http://localhost:4005";

const fetchAnalytics = async (period: string): Promise<AnalyticsApiResponse> => {
  const userId = localStorage.getItem("userId");
  const url = userId 
    ? `${CHAT_BASE}/api/v1/analytics?period=${period}&userId=${userId}` 
    : `${CHAT_BASE}/api/v1/analytics?period=${period}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch analytics");
  }
  
  return res.json();
};

export const useAnalytics = (period: string = "year") => {
  return useQuery({
    queryKey: ["analytics", period],
    queryFn: () => fetchAnalytics(period),
    staleTime: 15 * 60 * 1000, // Data is fresh for 15 minutes
    gcTime: 30 * 60 * 1000, // Cache persists for 30 minutes (formerly cacheTime)
    retry: 2,
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    refetchOnReconnect: true, // Refetch when internet reconnects
  });
};
