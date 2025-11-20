/**
 * Centralized API Service
 * All API calls should go through this service
 */

const API_BASE_URL = import.meta.env.VITE_EMAIL_SERVICE_URL || "http://localhost:4002";

// Type definitions
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

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T; response: Response }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();
  return { data, response };
}

// ============================================================================
// AUTH APIs
// ============================================================================

/**
 * Get Google OAuth URL
 * Redirects to Google OAuth flow
 */
export function getGoogleAuthUrl(): string {
  return `${API_BASE_URL}/auth/google`;
}

// ============================================================================
// EMAIL APIs
// ============================================================================

/**
 * Fetch and process emails from Gmail
 */
export async function fetchEmails(
  request: FetchEmailsRequest
): Promise<{ data: FetchEmailsResponse; response: Response }> {
  return apiCall<FetchEmailsResponse>("/api/v1/email/fetch", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================================
// SCHEDULED JOBS APIs
// ============================================================================

/**
 * Get all scheduled jobs for a user
 */
export async function getScheduledJobs(userId: string): Promise<{
  data: { message: string; count: number; jobs: ScheduledJob[] };
  response: Response;
}> {
  return apiCall(`/api/v1/emails/schedule/${userId}`);
}

/**
 * Cancel a scheduled job
 */
export async function cancelScheduledJob(
  userId: string,
  jobId: string
): Promise<{ data: { message: string; jobId: string }; response: Response }> {
  return apiCall(`/api/v1/emails/schedule/${userId}/${jobId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// USER APIs
// ============================================================================

/**
 * Get user sync status
 */
export async function getUserSyncStatus(userId: string): Promise<{
  data: SyncStatus;
  response: Response;
}> {
  return apiCall<SyncStatus>(`/api/v1/users/${userId}/sync-status`);
}

/**
 * Reset user sync status
 */
export async function resetUserSyncStatus(userId: string): Promise<{
  data: { message: string; userId: string };
  response: Response;
}> {
  return apiCall(`/api/v1/users/${userId}/sync-status`, {
    method: "DELETE",
  });
}

/**
 * Disconnect Google account (clear stored OAuth tokens)
 */
export async function disconnectGoogleAccount(userId: string): Promise<{ data: { message: string; userId: string; hasGoogleConnection?: boolean }; response: Response }> {
  return apiCall(`/api/v1/users/${userId}/disconnect-google`, { method: "POST" });
}

// ============================================================================
// VENDOR APIs
// ============================================================================

/**
 * Get all vendor folders for a user
 */
export async function getVendors(userId: string): Promise<{
  data: { userId: string; total: number; vendors: Vendor[] };
  response: Response;
}> {
  console.log('[api.getVendors] fetching vendors for userId', userId);
  const result = await apiCall<{ userId: string; total: number; vendors: Vendor[] }>(`/api/v1/drive/users/${userId}/vendors`);
  console.log('[api.getVendors] response status', result.response.status, 'data:', result.data);
  return result;
}

// ============================================================================
// INVOICE APIs
// ============================================================================

/**
 * Get all invoices for a specific vendor
 */
export async function getInvoices(
  userId: string,
  vendorId: string
): Promise<{
  data: {
    userId: string;
    vendorFolderId: string;
    invoiceFolderId: string;
    total: number;
    invoices: Invoice[];
  };
  response: Response;
}> {
  return apiCall(`/api/v1/drive/users/${userId}/vendors/${vendorId}/invoices`);
}

export async function getVendorMaster(
  userId: string,
  vendorId: string
): Promise<{
  data: MasterSummary;
  response: Response;
}> {
  return apiCall(`/api/v1/drive/users/${userId}/vendors/${vendorId}/master`);
}

// ============================================================================
// CHAT / RAG APIs
// ============================================================================

/**
 * Query Vendor knowledge base using RAG pipeline.
 */
export async function getChatAnswer(
  question: string,
  vendorName?: string,
  userId?: string
): Promise<{ data: ChatAnswerResponse; response: Response }> {
  const qs = new URLSearchParams({ question });
  if (vendorName) qs.append("vendor_name", vendorName);
  if (userId) qs.append("userId", userId);
  const url = `${CHAT_BASE_URL}/query?${qs.toString()}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await response.json();
  return { data, response };
}

export async function loadChatKnowledge(userId: string, incremental = true): Promise<{ data: any; response: Response }> {
  const url = `${CHAT_BASE_URL}/knowledge/load?userId=${encodeURIComponent(userId)}&incremental=${incremental}`;
  const response = await fetch(url, { method: "POST", headers: { Accept: "application/json" } });
  const data = await response.json();
  return { data, response };
}

export async function getChatVendorSummary(vendorName: string): Promise<{ data: ChatVendorSummary; response: Response }> {
  const url = `${CHAT_BASE_URL}/vendor/summary?vendor_name=${encodeURIComponent(vendorName)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await response.json();
  return { data, response };
}


// ============================================================================
// EXPORTS
// ============================================================================

export const api = {
  // Auth
  getGoogleAuthUrl,
  
  // Email
  fetchEmails,
  
  // Scheduled Jobs
  getScheduledJobs,
  cancelScheduledJob,
  
  // User
  getUserSyncStatus,
  resetUserSyncStatus,
  disconnectGoogleAccount,
  
  // Vendor
  getVendors,
  
  // Invoice
  getInvoices,
  getVendorMaster,
};

export default api;
