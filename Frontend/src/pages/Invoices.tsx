import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  RefreshCw, 
  Download, 
  ExternalLink, 
  Calendar, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
  Search,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import api, { type Invoice, type MasterRecord, type MasterSummary } from "@/services/api";

const BASE_CURRENCY = "INR";
const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const Invoices = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [userId, setUserId] = useState(() => searchParams.get("userId") || localStorage.getItem("tempUserId") || "690c7d0ee107fb31784c1b1b");
  const [vendorId, setVendorId] = useState(() => searchParams.get("vendorId") || "");
  const [vendorName, setVendorName] = useState(() => searchParams.get("vendorName") || "");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [masterSummary, setMasterSummary] = useState<MasterSummary | null>(null);
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [currencyPreference, setCurrencyPreference] = useState<SupportedCurrency>(BASE_CURRENCY);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [ratesTimestamp, setRatesTimestamp] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("tempUserId", userId);
  }, [userId]);

  useEffect(() => {
    if (userId && vendorId && /^[a-f0-9]{24}$/i.test(userId)) {
      fetchInvoices();
    }
  }, [userId, vendorId]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Exchange rate request failed with status ${response.status}`);
        }

        const payload = await response.json();

        if (payload.result !== "success" || !payload.rates) {
          const reason = payload["error-type"] || "Unable to retrieve exchange rates right now.";
          throw new Error(reason);
        }

        if (!isMounted) return;
        const normalizedRates = Object.entries(payload.rates as Record<string, unknown>).reduce<Record<string, number>>(
          (acc, [code, value]) => {
            if (typeof value === "number") {
              acc[code.toUpperCase()] = value;
            }
            return acc;
          },
          {}
        );
        normalizedRates[BASE_CURRENCY] = normalizedRates[BASE_CURRENCY] ?? 1;
        setExchangeRates(normalizedRates);
        setRatesError(null);
        const timestamp =
          typeof payload.time_last_update_unix === "number"
            ? new Date(payload.time_last_update_unix * 1000).toLocaleString()
            : typeof payload.time_last_update_utc === "string"
              ? payload.time_last_update_utc
              : null;
        setRatesTimestamp(timestamp);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          return;
        }
        if (!isMounted) return;
        setExchangeRates(null);
        setRatesError(error instanceof Error ? error.message : "Unexpected error loading exchange rates.");
        setRatesTimestamp(null);
      } finally {
        if (isMounted) {
          setRatesLoading(false);
        }
      }
    };

    fetchRates();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const fetchInvoices = async () => {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
      toast({
        title: "⚠️ Invalid User ID Format",
        description: "User ID must be exactly 24 characters (hexadecimal). Example: 690c7d0ee107fb31784c1b1b",
        variant: "destructive",
      });
      return;
    }

    if (!vendorId) {
      toast({
        title: "⚠️ Vendor Required",
        description: "Please select a vendor from the Vendors page or enter a Google Drive folder ID below.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setMasterSummary(null);
    setMasterError(null);
    try {
      const { data, response } = await api.getInvoices(userId, vendorId);

      if (response.ok) {
        setInvoices(data.invoices || []);
        if (data.total > 0) {
          toast({
            title: "✓ Invoices Loaded Successfully",
            description: `Found ${data.total} invoice ${data.total === 1 ? 'file' : 'files'} for ${vendorName || 'this vendor'}`,
          });
        } else {
          toast({
            title: "No Invoices Found",
            description: `No invoice files found for ${vendorName || 'this vendor'}. Try syncing emails to fetch new invoices.`,
            variant: "destructive",
          });
        }

        await fetchMasterSummary(userId, vendorId);
      } else {
        toast({
          title: "⚠️ Unable to Load Invoices",
          description:
            (data as any).message ||
            (data as any).details ||
            "Failed to fetch invoices from Google Drive. Verify your vendor ID and Google connection.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "🔌 Connection Failed",
        description: "Cannot reach the email service. Please ensure the backend is running on port 4002.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMasterSummary = async (selectedUserId: string, selectedVendorId: string) => {
    setIsMasterLoading(true);
    try {
      const { data, response } = await api.getVendorMaster(selectedUserId, selectedVendorId);
      if (!response.ok) {
        setMasterError(
          (data as any).message || data.reason || "Master data not available for this vendor yet."
        );
        setMasterSummary(null);
        return;
      }

      setMasterSummary(data);
      if (data.records?.length) {
        toast({
          title: "📊 Analytics Ready",
          description: `Loaded ${data.records.length} processed invoice ${
            data.records.length === 1 ? "entry" : "entries"
          } from master.json`,
        });
      } else {
        setMasterError("Master file found but contains no processed invoices yet.");
      }
    } catch (error) {
      setMasterError("Unable to load master analytics. Please ensure the OCR service uploaded master.json for this vendor.");
      setMasterSummary(null);
    } finally {
      setIsMasterLoading(false);
    }
  };

  const openInvoice = (webViewLink: string, fileName: string) => {
    window.open(webViewLink, '_blank', 'noopener,noreferrer');
    toast({
      title: "📄 Opening Invoice",
      description: `Opening ${fileName} in a new tab`,
    });
  };

  const downloadInvoice = (webContentLink: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = webContentLink;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "⬇️ Download Started",
      description: `Downloading ${fileName} to your device`,
    });
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (size?: string) => {
    if (!size) return "N/A";
    const bytes = parseInt(size);
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const masterRecords = masterSummary?.records ?? [];

  const getRecordField = (record: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return undefined;
  };

  const parseAmount = (value: unknown) => {
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const amount = Number(cleaned);
      return Number.isNaN(amount) ? 0 : amount;
    }
    return 0;
  };

  const inferCurrency = (record: Record<string, unknown>) => {
    const currencyValue = getRecordField(record, ["currency", "currency_code", "currencyCode"]);
    if (typeof currencyValue === "string" && currencyValue.length === 3) {
      return currencyValue.toUpperCase();
    }
    return BASE_CURRENCY;
  };

  const formatAmount = (amount: number, currencyCode: string) => {
    const normalizedCurrency = typeof currencyCode === "string" && currencyCode.length === 3
      ? currencyCode.toUpperCase()
      : BASE_CURRENCY;
    try {
      const locale = normalizedCurrency === "INR" ? "en-IN" : "en-US";
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  };

  const convertToBase = (amount: number, sourceCurrency: string) => {
    if (!Number.isFinite(amount)) return { value: 0, available: false } as const;
    if (sourceCurrency === BASE_CURRENCY) {
      return { value: amount, available: true } as const;
    }

    const rate = exchangeRates?.[sourceCurrency];
    if (!rate || rate === 0) {
      return { value: amount, available: false } as const;
    }

    return { value: amount / rate, available: true } as const;
  };

  const convertFromBase = (amount: number, targetCurrency: SupportedCurrency) => {
    if (!Number.isFinite(amount)) return { value: 0, available: false } as const;
    if (targetCurrency === BASE_CURRENCY) {
      return { value: amount, available: true } as const;
    }

    const rate = exchangeRates?.[targetCurrency];
    if (!rate || rate === 0) {
      return { value: amount, available: false } as const;
    }

    return { value: amount * rate, available: true } as const;
  };

  type AnalyticsRow = {
    invoiceNumber: string;
    invoiceDateDisplay: string;
    dueDateDisplay: string;
    dueDateRaw: Date | null;
    rawAmount: number;
    sourceCurrency: string;
    baseAmount: number;
    baseAvailable: boolean;
    displayAmount: number;
    displayCurrency: string;
    displayAvailable: boolean;
    status: string;
    processedDisplay: string;
    record: MasterRecord;
  };

  const analyticsRows: AnalyticsRow[] = masterRecords.map((record) => {
    const invoiceNumber = getRecordField(record, [
      "invoice_number",
      "invoiceNumber",
      "invoice_no",
      "invoiceNo",
      "invoice_id",
    ]);
    const invoiceDateValue = getRecordField(record, ["invoice_date", "invoiceDate", "date"]);
    const dueDateValue = getRecordField(record, ["due_date", "dueDate"]);
    const totalAmount = parseAmount(
      getRecordField(record, ["total_amount", "totalAmount", "amount_due", "amountDue", "grand_total", "grandTotal"])
    );
    const status = getRecordField(record, ["status", "payment_status", "paymentStatus"]);
    const processedAtValue = getRecordField(record, ["processed_at", "processedAt"]);
    const sourceCurrency = inferCurrency(record);

    const dueDateRaw = dueDateValue ? new Date(String(dueDateValue)) : null;
    const baseConversion = convertToBase(totalAmount, sourceCurrency);
    const targetConversion = convertFromBase(baseConversion.value, currencyPreference);

    const displayAvailable = baseConversion.available && targetConversion.available;
    const displayCurrency = displayAvailable ? currencyPreference : sourceCurrency;
    const displayAmount = displayAvailable ? targetConversion.value : totalAmount;

    return {
      invoiceNumber: invoiceNumber ? String(invoiceNumber) : "N/A",
      invoiceDateDisplay: invoiceDateValue ? formatDate(String(invoiceDateValue)) : "N/A",
      dueDateDisplay: dueDateValue ? formatDate(String(dueDateValue)) : "N/A",
      dueDateRaw,
      rawAmount: totalAmount,
      sourceCurrency,
      baseAmount: baseConversion.value,
      baseAvailable: baseConversion.available,
      displayAmount,
      displayCurrency,
      displayAvailable,
      status: status ? String(status) : "Unknown",
      processedDisplay: processedAtValue ? formatDate(String(processedAtValue)) : "N/A",
      record,
    };
  });

  const conversionEligibleRows = analyticsRows.filter((item) => item.displayAvailable);

  const totalAmountSum = conversionEligibleRows.reduce((sum, item) => sum + item.displayAmount, 0);
  const averageInvoiceValue = conversionEligibleRows.length
    ? totalAmountSum / conversionEligibleRows.length
    : 0;
  const overdueCount = analyticsRows.filter((item) => {
    if (!item.dueDateRaw || Number.isNaN(item.dueDateRaw.getTime())) return false;
    return item.dueDateRaw < new Date();
  }).length;

  const statusBreakdown = analyticsRows.reduce<Record<string, number>>((acc, item) => {
    const key = item.status || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const conversionUnavailableCount = analyticsRows.length - conversionEligibleRows.length;
  const aggregateCurrency = currencyPreference;

  const currencyOptions: { value: SupportedCurrency; label: string }[] = SUPPORTED_CURRENCIES.map((code) => ({
    value: code,
    label: code === BASE_CURRENCY ? `${code} (Base)` : code,
  }));

  const analyticsCard =
    (isMasterLoading || masterSummary || masterError) && (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Vendor Analytics</CardTitle>
            <CardDescription>
              Insights derived from OCR processed master.json for this vendor. Base currency {BASE_CURRENCY}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="currency-select" className="text-xs uppercase text-muted-foreground">
              Currency
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={currencyPreference}
                onValueChange={(value) => setCurrencyPreference(value as SupportedCurrency)}
                disabled={ratesLoading}
              >
                <SelectTrigger id="currency-select" className="w-[160px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ratesLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isMasterLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : masterError ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{masterError}</span>
            </div>
          ) : masterSummary && (
            <>
              {ratesError && (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{ratesError}</span>
                </div>
              )}
              {ratesTimestamp && !ratesError && (
                <p className="text-xs text-muted-foreground">
                  Rates updated: {ratesTimestamp} (base {BASE_CURRENCY})
                </p>
              )}
              {conversionUnavailableCount > 0 && !ratesError && !ratesLoading && (
                <p className="text-xs text-muted-foreground">
                  Missing exchange rates for {conversionUnavailableCount} invoice
                  {conversionUnavailableCount === 1 ? "" : "s"}. Those amounts remain in their
                  original currency.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-md border px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Processed Invoices</p>
                  <p className="mt-1 text-2xl font-semibold">{analyticsRows.length}</p>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground flex items-center justify-between gap-2">
                    <span>Total Amount</span>
                    <span className="font-mono text-[10px] text-muted-foreground/80">{aggregateCurrency}</span>
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {conversionEligibleRows.length
                      ? formatAmount(totalAmountSum, aggregateCurrency)
                      : "N/A"}
                  </p>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground flex items-center justify-between gap-2">
                    <span>Average Invoice</span>
                    <span className="font-mono text-[10px] text-muted-foreground/80">{aggregateCurrency}</span>
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {conversionEligibleRows.length
                      ? formatAmount(averageInvoiceValue, aggregateCurrency)
                      : "N/A"}
                  </p>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Invoices Past Due</p>
                  <p className="mt-1 text-2xl font-semibold">{overdueCount}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Master Updated</p>
                  <p className="mt-1 text-sm font-medium">
                    {masterSummary.updatedAt ? formatDate(masterSummary.updatedAt) : "Not available"}
                  </p>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Status Breakdown</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {Object.keys(statusBreakdown).length === 0 ? (
                      <span className="text-sm text-muted-foreground">No status data</span>
                    ) : (
                      Object.entries(statusBreakdown).map(([status, count]) => (
                        <Badge key={status} variant="outline" className="text-xs">
                          {status}: {count}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4">Invoice #</th>
                      <th className="py-2 pr-4">Invoice Date</th>
                      <th className="py-2 pr-4">Due Date</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Processed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsRows.map((row, index) => (
                      <tr key={`master-row-${index}`} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-mono text-xs">{row.invoiceNumber}</td>
                        <td className="py-2 pr-4">{row.invoiceDateDisplay}</td>
                        <td className="py-2 pr-4">{row.dueDateDisplay}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {row.displayAvailable ? (
                            formatAmount(row.displayAmount, row.displayCurrency)
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {formatAmount(row.rawAmount, row.sourceCurrency)}
                              <span className="ml-1">(rate unavailable)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary" className="text-xs">
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">{row.processedDisplay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analyticsRows.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Master file available but no structured invoice data detected yet.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/vendors')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              {vendorName ? `Viewing invoices for ${vendorName}` : "View invoice files from Google Drive"}
            </p>
          </div>
        </div>
        <Button onClick={fetchInvoices} disabled={isLoading || !vendorId}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Configuration Card */}
      {!searchParams.get("vendorId") && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set your user ID and vendor ID to fetch invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="userId">User ID (MongoDB ObjectId)</Label>
                <Input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="690c7d0ee107fb31784c1b1b"
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vendorId">Vendor ID (Google Drive Folder ID)</Label>
                <Input
                  id="vendorId"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  placeholder="1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp"
                  className="font-mono"
                />
              </div>
            </div>
            <Button onClick={fetchInvoices} disabled={isLoading} className="w-full">
              Load Invoices
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Vendor Info Badge */}
      {vendorName && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-sm">
            Vendor: {vendorName}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 text-sm font-mono">
            ID: {vendorId.substring(0, 12)}...
          </Badge>
        </div>
      )}

      {analyticsCard}

      {/* Search Bar */}
      {invoices.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredInvoices.length} of {invoices.length} invoices
          </span>
        </div>
      )}

      {/* Invoices List */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading invoices...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-center">
            {invoices.length === 0 ? (
              <>
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Invoices Available</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-3">
                  {vendorId 
                    ? `No invoice files found for ${vendorName || 'this vendor'}. This could mean:`
                    : "To view invoices, you need to select a vendor first."}
                </p>
                {vendorId && (
                  <ul className="text-xs text-muted-foreground max-w-md text-left mb-3 space-y-1">
                    <li>• No emails have been synced from this vendor yet</li>
                    <li>• The vendor's emails don't contain PDF attachments</li>
                    <li>• The invoice folder is empty in Google Drive</li>
                  </ul>
                )}
                <p className="text-xs text-muted-foreground max-w-md">
                  💡 Tip: {vendorId ? "Go to Email Sync and fetch emails from this vendor's email address" : "Navigate to the Vendors page to browse available vendors"}
                </p>
                {vendorId && (
                  <Button onClick={() => navigate('/email-sync')} className="mt-4">
                    Go to Email Sync
                  </Button>
                )}
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Matches</h3>
                <p className="text-sm text-muted-foreground">
                  No invoices match your search query "{searchQuery}"
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice, index) => (
            <Card
              key={invoice.id}
              className="hover:shadow-md transition-all animate-in fade-in slide-in-from-left-4"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{invoice.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {invoice.createdTime && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(invoice.createdTime)}
                          </span>
                        )}
                        {invoice.size && (
                          <span>{formatFileSize(invoice.size)}</span>
                        )}
                        <span className="font-mono truncate">{invoice.id.substring(0, 10)}...</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openInvoice(invoice.webViewLink, invoice.name)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => downloadInvoice(invoice.webContentLink, invoice.name)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {invoices.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Total Invoices:</span>
                </div>
                <span className="text-2xl font-bold text-primary">{invoices.length}</span>
              </div>
              {filteredInvoices.length !== invoices.length && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Filtered:</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">{filteredInvoices.length}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Section relocated above */}
    </div>
  );
};

export default Invoices;
