import { useQuery } from "@tanstack/react-query";
import api, { type ScheduledJob } from "@/services/api";

interface ScheduledJobsApiResponse {
  jobs: ScheduledJob[];
  total: number;
}

const fetchScheduledJobs = async (userId: string): Promise<ScheduledJobsApiResponse> => {
  if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
    throw new Error("Invalid User ID format");
  }

  const { data, response } = await api.getScheduledJobs(userId);

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch scheduled jobs");
  }

  return {
    jobs: data.jobs || [],
    total: data.jobs?.length || 0,
  };
};

export const useScheduledJobs = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["scheduledJobs", userId],
    queryFn: () => fetchScheduledJobs(userId),
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    gcTime: 15 * 60 * 1000, // Cache persists for 15 minutes
    retry: 2,
    enabled: enabled && !!userId && /^[a-f0-9]{24}$/i.test(userId),
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    refetchOnReconnect: true, // Refetch when internet reconnects
  });
};
