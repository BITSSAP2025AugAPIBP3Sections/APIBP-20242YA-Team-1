import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  Mail, 
  RefreshCw, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Folder,
  AlertCircle,
  ExternalLink,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api, { type SyncStatus, type Vendor as VendorFolder, type FetchEmailsRequest } from "@/services/api";

interface EmailLog {
  id: string;
  timestamp: string;
  type: "success" | "error" | "info" | "processing" | "complete";
  message: string;
}

const EmailSync = () => {
  const { toast } = useToast();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load from localStorage to persist across page changes
  const [userId, setUserId] = useState(() => localStorage.getItem("tempUserId") || "690c7d0ee107fb31784c1b1b");
  const [fromDate, setFromDate] = useState(() => localStorage.getItem("emailSyncFromDate") || new Date().toISOString().split('T')[0]);
  const [vendorEmails, setVendorEmails] = useState(() => localStorage.getItem("emailSyncVendorEmails") || "");
  const [scheduleType, setScheduleType] = useState<"manual" | "auto">(() => (localStorage.getItem("emailSyncScheduleType") as "manual" | "auto") || "manual");
  const [frequency, setFrequency] = useState<"hourly" | "daily" | "weekly">(() => (localStorage.getItem("emailSyncFrequency") as "hourly" | "daily" | "weekly") || "daily");
  const [forceSync, setForceSync] = useState(() => localStorage.getItem("emailSyncForceSync") === "true");
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [vendorFolders, setVendorFolders] = useState<VendorFolder[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0, message: "" });

  const addLog = (type: EmailLog["type"], message: string) => {
    const newLog: EmailLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem("tempUserId", userId);
  }, [userId]);

  useEffect(() => {
    localStorage.setItem("emailSyncFromDate", fromDate);
  }, [fromDate]);

  useEffect(() => {
    localStorage.setItem("emailSyncVendorEmails", vendorEmails);
  }, [vendorEmails]);

  useEffect(() => {
    localStorage.setItem("emailSyncScheduleType", scheduleType);
  }, [scheduleType]);

  useEffect(() => {
    localStorage.setItem("emailSyncFrequency", frequency);
  }, [frequency]);

  useEffect(() => {
    localStorage.setItem("emailSyncForceSync", String(forceSync));
  }, [forceSync]);

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Check sync status on mount and when userId changes
  useEffect(() => {
    if (userId && /^[a-f0-9]{24}$/i.test(userId)) {
      fetchSyncStatus();
    }
  }, [userId]);

  // Handle OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const email = params.get('email');
    const returnedUserId = params.get('userId');

    if (connected === 'true' && email) {
      // Update userId if returned from backend
      if (returnedUserId) {
        setUserId(returnedUserId);
        localStorage.setItem("tempUserId", returnedUserId);
      }

      addLog("success", `✓ Google account connected successfully as ${email}`);
      toast({
        title: "Connected!",
        description: `Google account connected as ${email}`,
      });

      // Clean up URL
      window.history.replaceState({}, '', '/email-sync');

      // Refresh sync status
      setTimeout(() => fetchSyncStatus(), 1000);
    }
  }, []);

  const fetchSyncStatus = async () => {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
      addLog("error", "Invalid userId format. Must be a 24-character MongoDB ObjectId.");
      return;
    }

    setIsLoadingStatus(true);
    try {
      const { data, response } = await api.getUserSyncStatus(userId);

      if (response.ok) {
        setSyncStatus(data);
        setIsConnected(data.hasGoogleConnection);
        addLog("success", `Sync status loaded: ${data.message}`);
      } else {
        addLog("error", data.message || "Failed to fetch sync status");
        setSyncStatus(null);
        setIsConnected(false);
      }
    } catch (error) {
      addLog("error", `Network error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsConnected(false);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const connectGoogleAccount = () => {
    addLog("info", "Redirecting to Google OAuth...");
    // Use window.location for full page redirect (not new tab)
    window.location.href = api.getGoogleAuthUrl();
  };

  const fetchEmails = async () => {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
      toast({
        title: "Invalid User ID",
        description: "Please provide a valid 24-character MongoDB ObjectId.",
        variant: "destructive",
      });
      return;
    }

    if (!fromDate) {
      toast({
        title: "Missing Date",
        description: "Please select a 'From Date'.",
        variant: "destructive",
      });
      return;
    }

    setIsFetching(true);
    setFetchProgress({ current: 0, total: 0, message: "Starting email fetch..." });
    addLog("processing", `Starting email fetch from ${fromDate}...`);

    const body: any = {
      userId,
      fromDate,
      forceSync,
      schedule: scheduleType === "manual" ? "manual" : { type: "auto", frequency },
    };

    if (vendorEmails.trim()) {
      body.email = vendorEmails.trim();
      addLog("info", `Filtering by vendor emails: ${vendorEmails}`);
    }

    // Clear any existing progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Simulate progress (since backend processes all at once)
    progressIntervalRef.current = setInterval(() => {
      setFetchProgress(prev => {
        if (prev.total === 0) return { current: 0, total: 100, message: "Connecting to Gmail..." };
        if (prev.current < 90) {
          return { 
            current: prev.current + 2, 
            total: 100, 
            message: "Fetching and processing emails..." 
          };
        }
        return prev;
      });
    }, 1000);

    try {
      const { data, response } = await api.fetchEmails(body as FetchEmailsRequest);

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        // Not JSON - likely rate limit or error HTML
        const text = await response.text();
        addLog("error", `Server returned non-JSON response: ${text.substring(0, 200)}`);
        toast({
          title: "Server Error",
          description: text.includes("Too many") ? "Rate limit exceeded. Please wait before retrying." : "Server returned an invalid response",
          variant: "destructive",
        });
        return;
      }

      setFetchProgress({ current: 100, total: 100, message: "Processing complete!" });

      if (response.ok) {
        // Show summary
        const totalProcessed = data.result?.totalProcessed || 0;
        const filesUploaded = data.result?.filesUploaded || 0;
        
        addLog("complete", `✅ EMAIL FETCH COMPLETED SUCCESSFULLY`);
        addLog("info", `📧 Total emails processed: ${totalProcessed}`);
        addLog("info", `📎 Files uploaded: ${filesUploaded}`);

        // Show vendors detected
        if (data.result?.vendorsDetected && data.result.vendorsDetected.length > 0) {
          addLog("info", `🏢 Vendors detected: ${data.result.vendorsDetected.join(", ")}`);
        }

        // Show detailed upload information
        if (data.result?.uploadedFiles && data.result.uploadedFiles.length > 0) {
          addLog("info", `📁 Files uploaded to Drive:`);
          data.result.uploadedFiles.forEach((file, index) => {
            addLog("success", `  ✓ ${index + 1}. ${file.vendor}/invoices/${file.filename}`);
          });
        }

        if (data.jobId && scheduleType === "auto") {
          addLog("success", `⏰ Scheduled ${frequency} fetch created (Job ID: ${data.jobId})`);
        }

        setFetchProgress({ current: 0, total: 0, message: "" });

        toast({
          title: "✅ Fetch Complete!",
          description: `${filesUploaded} files uploaded from ${totalProcessed} emails`,
        });

        // Refresh sync status and vendors
        fetchSyncStatus();
        fetchVendorFolders();
      } else {
        addLog("error", `✗ ${data.message || "Failed to fetch emails"}`);
        
        if (data.details) {
          addLog("error", `Details: ${data.details}`);
        }
        
        if (data.suggestions && Array.isArray(data.suggestions)) {
          data.suggestions.forEach((suggestion: string) => {
            addLog("info", `💡 ${suggestion}`);
          });
        }

        toast({
          title: "Error",
          description: data.message || "Failed to fetch emails",
          variant: "destructive",
        });
      }
    } catch (error) {
      setFetchProgress({ current: 0, total: 0, message: "" });
      addLog("error", `Network error: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast({
        title: "Network Error",
        description: "Could not connect to email service",
        variant: "destructive",
      });
    } finally {
      // Always clear the progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsFetching(false);
    }
  };

  const fetchVendorFolders = async () => {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
      return;
    }

    setIsLoadingVendors(true);
    addLog("info", "Fetching vendor folders from Google Drive...");

    try {
      const { data, response } = await api.getVendors(userId);

      if (response.ok && data.vendors) {
        setVendorFolders(data.vendors);
        addLog("success", `📁 Found ${data.vendors.length} vendor folders`);
      } else {
        addLog("error", "Failed to fetch vendor folders");
        setVendorFolders([]);
      }
    } catch (error) {
      addLog("error", `Failed to fetch vendors: ${error instanceof Error ? error.message : "Unknown"}`);
      setVendorFolders([]);
    } finally {
      setIsLoadingVendors(false);
    }
  };

  const resetSyncStatus = async () => {
    if (!userId) return;

    addLog("processing", "Resetting sync status...");

    try {
      const { data, response } = await api.resetUserSyncStatus(userId);

      if (response.ok) {
        addLog("success", "✓ Sync status reset successfully");
        toast({
          title: "Success",
          description: "Sync status reset. Next fetch will use the fromDate parameter.",
        });
        fetchSyncStatus();
      } else {
        addLog("error", data.message || "Failed to reset sync status");
        toast({
          title: "Error",
          description: data.message || "Failed to reset sync status",
          variant: "destructive",
        });
      }
    } catch (error) {
      addLog("error", `Network error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };

  const getLogIcon = (type: EmailLog["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLogStyle = (type: EmailLog["type"]) => {
    if (type === "complete") {
      return "bg-green-500/10 border-green-500/30";
    }
    return "";
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Sync Manager</h2>
          <p className="text-muted-foreground">
            Connect Gmail, fetch emails, and organize invoices automatically
          </p>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Google Account Connection
            </h3>
            <p className="text-sm text-muted-foreground">
              {isConnected 
                ? `Connected as: ${syncStatus?.email || "Unknown"}`
                : "Connect your Google account from Settings to start syncing emails"
              }
            </p>
            {syncStatus?.lastSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(syncStatus.lastSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Connected</span>
                </div>
                <Button onClick={resetSyncStatus} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Sync
                </Button>
              </>
            ) : (
              <Button onClick={() => window.location.href = '/settings'} variant="outline" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Settings
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Fetch Configuration Card */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Email Fetch Configuration
          </h3>

          <div className="space-y-4">
            {/* Temp User ID Field */}
            <div className="space-y-2">
              <Label htmlFor="userId">
                User ID <span className="text-xs text-muted-foreground">(Temporary - Auth service down)</span>
              </Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="690c7d0ee107fb31784c1b1b"
              />
              <p className="text-xs text-muted-foreground">
                24-character MongoDB ObjectId
              </p>
            </div>

            {/* From Date */}
            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date *</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* Vendor Emails (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="vendorEmails">
                Vendor Emails <span className="text-xs text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="vendorEmails"
                value={vendorEmails}
                onChange={(e) => setVendorEmails(e.target.value)}
                placeholder="ship-confirm@amazon.in,orders@zomato.com"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated email addresses to filter specific vendors
              </p>
            </div>

            {/* Schedule Type */}
            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="manual"
                    checked={scheduleType === "manual"}
                    onChange={(e) => setScheduleType(e.target.value as "manual")}
                  />
                  <span>Manual (One-time)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="auto"
                    checked={scheduleType === "auto"}
                    onChange={(e) => setScheduleType(e.target.value as "auto")}
                  />
                  <span>Automatic (Scheduled)</span>
                </label>
              </div>
            </div>

            {/* Frequency (if auto) */}
            {scheduleType === "auto" && (
              <div className="space-y-2">
                <Label>Frequency</Label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            )}

            {/* Force Sync */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceSync}
                onChange={(e) => setForceSync(e.target.checked)}
              />
              <span className="text-sm">
                Force sync (ignore last sync timestamp)
              </span>
            </label>

            {/* Progress Bar */}
            {isFetching && fetchProgress.total > 0 && (
              <div className="space-y-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-600">
                    {fetchProgress.message || "Processing emails..."}
                  </span>
                  <span className="text-blue-600 font-mono">
                    {fetchProgress.current}/{fetchProgress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={fetchEmails} 
                disabled={!isConnected || isFetching}
                className="flex-1"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Fetch Emails
                  </>
                )}
              </Button>
              <Button 
                onClick={fetchSyncStatus} 
                variant="outline"
                disabled={isLoadingStatus}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingStatus ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </Card>

        {/* Vendor Folders Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Vendor Folders in Drive
            </h3>
            <Button 
              onClick={fetchVendorFolders} 
              variant="outline" 
              size="sm"
              disabled={!isConnected || isLoadingVendors}
            >
              {isLoadingVendors ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {vendorFolders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No vendor folders yet</p>
                <p className="text-xs">Fetch emails to create vendor folders</p>
              </div>
            ) : (
              vendorFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{folder.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(folder.webViewLink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Activity Logs Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Logs
          </h3>
          <Button 
            onClick={() => setLogs([])} 
            variant="outline" 
            size="sm"
          >
            Clear Logs
          </Button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No activity yet</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2 p-2 rounded border hover:bg-accent transition-colors ${getLogStyle(log.type)}`}
              >
                {getLogIcon(log.type)}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <p className={`break-words ${log.type === "complete" ? "font-semibold text-green-600" : ""}`}>
                    {log.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default EmailSync;
