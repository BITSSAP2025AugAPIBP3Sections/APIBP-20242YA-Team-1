/**
 * Centralized API Service — UPDATED FOR API GATEWAY
 * All frontend calls now go through:
 * http://localhost:4000/{service-prefix}/...
 */

const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

export const API_ENDPOINTS = {
  AUTH: `${API_GATEWAY_URL}/auth`,
  EMAIL: `${API_GATEWAY_URL}/email`,
  OCR: `${API_GATEWAY_URL}/ocr`,
  CHAT: `${API_GATEWAY_URL}/chat`,
  ANALYTICS: `${API_GATEWAY_URL}/analytics`,
};

export interface SyncStatus {
  userId: string;
  email: string;
  lastSyncedAt: string | null;
  hasGoogleConnection: boolean;
  message: string;
}

export interface Vendor {
  id: string;
  name: string;
  createdTime: string;
  webViewLink?: string;
}

export interface Invoice {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

export interface MasterRecord extends Record<string, unknown> {
  drive_file_id?: string;
  file_name?: string;
  vendor_name?: string;
  processed_at?: string;
  web_view_link?: string | null;
  web_content_link?: string | null;
}

export interface MasterSummary {
  userId: string;
  vendorFolderId: string;
  invoiceFolderId: string | null;
  masterFileId: string | null;
  updatedAt: string | null;
  size: number | null;
  missing: boolean;
  reason?: string | null;
  records: MasterRecord[];
}

export interface ScheduledJob {
  jobId: string;
  userId: string;
  filters: {
    emails?: string[];
    emailCount?: number;
    onlyPdf?: boolean;
    fromDate: string;
    forceSync?: boolean;
  };
  frequency: "hourly" | "daily" | "weekly";
  nextRun?: string;
  status?: "active" | "paused";
  createdAt: string;
}

export interface ChatSource {
  rank: number;
  vendor_name?: string;
  similarity?: number;
  content_excerpt?: string;
}

export interface ChatAnswerResponse {
  success: boolean;
  vendor_name: string | null;
  question: string;
  answer: string;
  sources: ChatSource[];
  message?: string;
  context_text?: string;
  vendor_detection?: string;
}

export interface ChatVendorSummary {
  success: boolean;
  vendor_info?: {
    vendor_name: string;
    total_chunks: number;
    invoices: { invoice_number: string; amount: any; invoice_date: string }[];
    summary: { last_updated?: string; total_invoices?: number; total_amount?: number };
  };
  message?: string;
}

export interface AnalyticsResponse {
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

export interface FetchEmailsRequest {
  userId: string;
  fromDate: string;
  email?: string;
  onlyPdf?: boolean;
  forceSync?: boolean;
  schedule: "manual" | { type: "auto"; frequency: "hourly" | "daily" | "weekly" };
}

export interface FetchEmailsResponse {
  message: string;
  jobId?: string;
  details?: string;
  suggestions?: string[];
  statusEndpoint?: string;
  result?: {
    totalProcessed: number;
    filesUploaded: number;
    uploadedFiles: Array<{
      vendor: string;
      filename: string;
      path: string;
      uploadedAt: string;
    }>;
    vendorsDetected: string[];
  };
  filtersUsed?: {
    emails: string[];
    emailCount: number;
    onlyPdf: boolean;
    fromDate: string;
    forceSync: boolean;
  };
}

export interface JobStatus {
  jobId: string;
  userId: string;
  status: "processing" | "completed" | "failed";
  filters: {
    emails: string[] | null;
    emailCount: number;
    onlyPdf: boolean;
    fromDate: string;
    forceSync: boolean;
  };
  createdAt: string;
  completedAt?: string;
  result?: {
    totalProcessed: number;
    filesUploaded: number;
    uploadedFiles: Array<{
      vendor: string;
      filename: string;
      path: string;
      uploadedAt: string;
    }>;
    vendorsDetected: string[];
  };
  error?: {
    message: string;
    timestamp: string;
  };
}

// ===============================================
// Helper wrapper (always uses API Gateway)
// ===============================================
async function apiCall<T>(
  fullPath: string,
  options?: RequestInit & { skipAuth?: boolean; timeout?: number }
): Promise<{ data: T; response: Response }> {
  const timeoutMs = options?.timeout || 120000; // Default 2 minutes
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${API_GATEWAY_URL}${fullPath}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({} as T));
    return { data, response };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// ===============================================
// AUTH APIs (via gateway /auth/...)
// ===============================================

export function getGoogleAuthUrl(): string {
  return `${API_GATEWAY_URL}/email/auth/google`;
}

// ===============================================
// EMAIL APIs (via gateway /email/...)
// ===============================================

export async function fetchEmails(
  request: FetchEmailsRequest
) {
  return apiCall<FetchEmailsResponse>(
    `/email/api/v1/email/fetch`,
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}

/**
 * Check the status of an email fetch job
 */
export async function getJobStatus(jobId: string) {
  return apiCall<JobStatus>(
    `/email/api/v1/email/jobs/${jobId}`
  );
}

/**
 * Poll for job completion with exponential backoff
 * @param jobId - The job ID to poll
 * @param maxAttempts - Maximum number of polling attempts (default: 60)
 * @param initialInterval - Initial polling interval in ms (default: 2000)
 * @param maxInterval - Maximum polling interval in ms (default: 10000)
 * @returns Promise that resolves when job completes or fails
 */
export async function pollJobStatus(
  jobId: string,
  maxAttempts = 60,
  initialInterval = 2000,
  maxInterval = 10000
): Promise<JobStatus> {
  let attempts = 0;
  let interval = initialInterval;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const { data, response } = await getJobStatus(jobId);
      
      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`);
      }

      // Job completed successfully
      if (data.status === "completed") {
        return data;
      }

      // Job failed
      if (data.status === "failed") {
        throw new Error(data.error?.message || "Job failed");
      }

      // Still processing - wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));
      
      // Exponential backoff (cap at maxInterval)
      interval = Math.min(interval * 1.5, maxInterval);
      
    } catch (error) {
      // If it's a job completion error (failed status), throw it
      if (error instanceof Error && error.message.includes("Job failed")) {
        throw error;
      }
      
      // For network errors, retry
      console.warn(`Poll attempt ${attempts} failed:`, error);
      
      if (attempts >= maxAttempts) {
        throw new Error("Job polling timeout - max attempts reached");
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  throw new Error("Job polling timeout - max attempts reached");
}

/**
 * Fetch emails with automatic polling until completion
 * This is a convenience wrapper around fetchEmails + pollJobStatus
 */
export async function fetchEmailsWithPolling(
  request: FetchEmailsRequest,
  onProgress?: (status: JobStatus) => void
): Promise<JobStatus> {
  // Start the job
  const { data: startResponse, response } = await fetchEmails(request);
  
  if (!response.ok) {
    throw new Error(startResponse.message || "Failed to start email fetch");
  }

  const jobId = startResponse.jobId;
  if (!jobId) {
    // Old behavior - job completed synchronously
    return {
      jobId: "sync",
      userId: request.userId,
      status: "completed",
      filters: {
        emails: request.email ? [request.email] : null,
        emailCount: 0,
        onlyPdf: request.onlyPdf ?? true,
        fromDate: request.fromDate,
        forceSync: request.forceSync ?? false,
      },
      createdAt: new Date().toISOString(),
      result: startResponse.result,
    };
  }

  // Poll for completion with progress callbacks
  let lastStatus: JobStatus | null = null;
  const pollWithProgress = async () => {
    return pollJobStatus(jobId, 60, 2000, 10000);
  };

  // Optional: set up interval for progress updates
  let progressInterval: NodeJS.Timeout | null = null;
  if (onProgress) {
    progressInterval = setInterval(async () => {
      try {
        const { data } = await getJobStatus(jobId);
        if (JSON.stringify(data) !== JSON.stringify(lastStatus)) {
          lastStatus = data;
          onProgress(data);
        }
      } catch (err) {
        console.warn("Progress check failed:", err);
      }
    }, 3000);
  }

  try {
    const result = await pollWithProgress();
    return result;
  } finally {
    if (progressInterval) {
      clearInterval(progressInterval);
    }
  }
}

export async function getScheduledJobs(userId: string) {
  return apiCall(`/email/api/v1/emails/schedule/${userId}`);
}

export async function cancelScheduledJob(userId: string, jobId: string) {
  return apiCall(
    `/email/api/v1/emails/schedule/${userId}/${jobId}`,
    { method: "DELETE" }
  );
}

export async function getUserSyncStatus(userId: string) {
  return apiCall<SyncStatus>(`/email/api/v1/users/${userId}/sync-status`);
}

export async function resetUserSyncStatus(userId: string) {
  return apiCall(`/email/api/v1/users/${userId}/sync-status`, {
    method: "DELETE",
  });
}

export async function disconnectGoogleAccount(userId: string) {
  return apiCall(
    `/email/api/v1/users/${userId}/disconnect-google`,
    { method: "POST" }
  );
}

export async function getVendors(userId: string) {
  return apiCall<{ userId: string; total: number; vendors: Vendor[] }>(
    `/email/api/v1/drive/users/${userId}/vendors`
  );
}

export async function getInvoices(userId: string, vendorId: string) {
  return apiCall(
    `/email/api/v1/drive/users/${userId}/vendors/${vendorId}/invoices`
  );
}

export async function getVendorMaster(userId: string, vendorId: string) {
  return apiCall<MasterSummary>(
    `/email/api/v1/drive/users/${userId}/vendors/${vendorId}/master`
  );
}

// ===============================================
// CHAT APIs (via gateway /chat/...)
// ===============================================

export async function getChatAnswer(question: string, vendorName?: string, userId?: string) {
  const qs = new URLSearchParams({ question });
  if (vendorName) qs.append("vendor_name", vendorName);
  if (userId) qs.append("userId", userId);

  return apiCall<ChatAnswerResponse>(
    `/chat/api/v1/query?${qs.toString()}`
  );
}

export async function loadChatKnowledge(userId: string, incremental = true) {
  return apiCall(
    `/chat/api/v1/knowledge/load?userId=${userId}&incremental=${incremental}`,
    { method: "POST" }
  );
}

export async function getChatVendorSummary(vendorName: string) {
  return apiCall<ChatVendorSummary>(
    `/chat/api/v1/vendor/summary?vendor_name=${encodeURIComponent(vendorName)}`
  );
}

export async function getAnalytics(period: string, userId?: string) {
  const qs = new URLSearchParams({ period });
  if (userId) qs.append("userId", userId);

  return apiCall<AnalyticsResponse>(
    `/chat/api/v1/analytics?${qs.toString()}`
  );
}

export const api = {
  // Auth
  getGoogleAuthUrl,

  // Email
  fetchEmails,
  getJobStatus,
  pollJobStatus,
  fetchEmailsWithPolling,
  getScheduledJobs,
  cancelScheduledJob,
  getUserSyncStatus,
  resetUserSyncStatus,
  disconnectGoogleAccount,
  getVendors,
  getInvoices,
  getVendorMaster,

  // Chat
  getChatAnswer,
  loadChatKnowledge,
  getChatVendorSummary,
  getAnalytics,
};

export default api;
