import { useQuery } from "@tanstack/react-query";
import api, { type Vendor } from "@/services/api";

interface VendorsApiResponse {
  vendors: Vendor[];
  total: number;
}

const fetchVendors = async (userId: string): Promise<VendorsApiResponse> => {
  if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
    throw new Error("Invalid User ID format");
  }

  const { data, response } = await api.getVendors(userId);

  if (!response.ok) {
    throw new Error("Failed to fetch vendors");
  }

  return {
    vendors: data.vendors || [],
    total: data.total || 0,
  };
};

export const useVendors = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["vendors", userId],
    queryFn: () => fetchVendors(userId),
    staleTime: 10 * 60 * 1000, // Data is fresh for 10 minutes
    gcTime: 20 * 60 * 1000, // Cache persists for 20 minutes
    retry: 2,
    enabled: enabled && !!userId && /^[a-f0-9]{24}$/i.test(userId),
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    refetchOnReconnect: true, // Refetch when internet reconnects
  });
};
