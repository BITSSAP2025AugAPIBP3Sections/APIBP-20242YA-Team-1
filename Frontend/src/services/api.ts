/**
 * Centralized API Service
 * All API calls should go through this service
 */

const API_BASE_URL = import.meta.env.VITE_EMAIL_SERVICE_URL || "http://localhost:4002";
// Added: dedicated auth service base (different port) for /auth/me token retrieval
const AUTH_BASE_URL = (import.meta as any).env?.VITE_AUTH_SERVICE_URL || "http://localhost:4001";
// Chat service base (ensure defined to prevent runtime ReferenceError)
// Priority order: explicit VITE_CHAT_BASE_URL, legacy VITE_CHAT_API_URL, fallback localhost
const CHAT_BASE_URL = (import.meta as any).env?.VITE_CHAT_BASE_URL
  || (import.meta as any).env?.VITE_CHAT_API_URL
  || "http://localhost:4005/api/v1";

const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:4000';

export const API_ENDPOINTS = {
  AUTH: `${API_GATEWAY_URL}/api/v1/auth`,
  EMAIL: `${API_GATEWAY_URL}/api/v1/email`,
  OCR: `${API_GATEWAY_URL}/api/v1/ocr`,
  CHAT: `${API_GATEWAY_URL}/api/v1/chat`,
  ANALYTICS: `${API_GATEWAY_URL}/api/v1/analytics`,
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

// Chat / RAG Types
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

// ============================================================
// Access Token Handling (Bearer)
// ============================================================
let accessToken: string | null = null; // in-memory cache (not persisted)
let triedFetchMe = false; // avoid repeated /auth/me calls

/**
 * Manually set (or clear) the access token after login/logout flows.
 */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Retrieve current access token, attempting single lazy fetch via /auth/me if not cached.
 * Uses auth service base. Relies on httpOnly cookie being sent automatically (credentials: 'include').
 */
export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  if (triedFetchMe) return null; // already attempted, don't spam
  triedFetchMe = true;
  try {
    const resp = await fetch(`${AUTH_BASE_URL}/api/v1/auth/me`, { credentials: 'include' });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (json?.isAuthenticated && json?.access_token) {
      accessToken = json.access_token;
      return accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper function for API calls (email-storage-service)
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<{ data: T; response: Response }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const publicPaths = new Set<string>(['/', '/health', '/api-info', '/api-docs', '/auth/google', '/auth/google/callback']);
  let authHeader: Record<string, string> = {};
  if (!options?.skipAuth && !publicPaths.has(endpoint)) {
    const token = await ensureAccessToken();
    if (token) authHeader.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options?.headers,
    },
    credentials: 'include', // ensure cookies (refresh/access) are sent for any silent flows
  });
  const data = await response.json();
  return { data, response };
}

// ============================================================================
// AUTH APIs
// ============================================================================

/**
 * Get Google OAuth URL
 * Redirects to Google OAuth flow (public – skip bearer attachment)
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
