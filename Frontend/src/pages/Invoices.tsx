import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import api, { type Invoice } from "@/services/api";

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

  useEffect(() => {
    localStorage.setItem("tempUserId", userId);
  }, [userId]);

  useEffect(() => {
    if (userId && vendorId && /^[a-f0-9]{24}$/i.test(userId)) {
      fetchInvoices();
    }
  }, [userId, vendorId]);

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
      } else {
        toast({
          title: "⚠️ Unable to Load Invoices",
          description: data.message || data.details || "Failed to fetch invoices from Google Drive. Verify your vendor ID and Google connection.",
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
    </div>
  );
};

export default Invoices;
