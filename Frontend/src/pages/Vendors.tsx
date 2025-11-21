import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, RefreshCw, Folder, FileText, Calendar, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import api, { type Vendor } from "@/services/api";

const Vendors = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userId, setUserId] = useState(() => localStorage.getItem("tempUserId") || "690c7d0ee107fb31784c1b1b");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("tempUserId", userId);
  }, [userId]);

  useEffect(() => {
    if (userId && /^[a-f0-9]{24}$/i.test(userId)) {
      fetchVendors();
    }
  }, [userId]);

  const fetchVendors = async () => {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
      toast({
        title: "⚠️ Invalid User ID Format",
        description: "User ID must be exactly 24 characters (hexadecimal). Example: 690c7d0ee107fb31784c1b1b",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, response } = await api.getVendors(userId);

      if (response.ok) {
        setVendors(data.vendors || []);
        if (data.total > 0) {
          toast({
            title: "✓ Vendors Loaded Successfully",
            description: `Found ${data.total} vendor ${data.total === 1 ? 'folder' : 'folders'} in your Google Drive`,
          });
        } else {
          toast({
            title: "No Vendors Found",
            description: "No vendor folders exist yet. Sync emails first to create vendor folders.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "⚠️ Unable to Load Vendors",
          description: "Failed to fetch vendors from Google Drive. Please check your Google connection.",
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

  const viewInvoices = (vendorId: string, vendorName: string) => {
    navigate(`/invoices?userId=${userId}&vendorId=${vendorId}&vendorName=${encodeURIComponent(vendorName)}`);
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  // Pagination for vendors (7 per page)
  const VENDOR_PAGE_SIZE = 7;
  const [vendorPage, setVendorPage] = useState(1);
  const vendorTotalPages = Math.max(1, Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE));
  const paginatedVendors = filteredVendors.slice((vendorPage - 1) * VENDOR_PAGE_SIZE, vendorPage * VENDOR_PAGE_SIZE);
  useEffect(() => {
    if (vendorPage > vendorTotalPages) setVendorPage(1);
  }, [filteredVendors.length, vendorTotalPages, vendorPage]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground mt-1">
            View all vendor folders from Google Drive
          </p>
        </div>
        <Button onClick={fetchVendors} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Set your user ID to fetch vendor folders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="userId">User ID (MongoDB ObjectId)</Label>
            <div className="flex gap-2">
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="690c7d0ee107fb31784c1b1b"
                className="font-mono"
              />
              <Button onClick={fetchVendors} disabled={isLoading}>
                Load Vendors
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Must be a valid 24-character hexadecimal MongoDB ObjectId
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      {vendors.length > 0 && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {/* Vendors Grid */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading vendors...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredVendors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-center">
            {vendors.length === 0 ? (
              <>
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Vendors Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-3">
                  You haven't synced any emails yet. Vendor folders are automatically created when you fetch emails with invoice attachments.
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  💡 Tip: Go to Email Sync, connect your Google account, and fetch emails to populate vendors.
                </p>
                <Button onClick={() => navigate('/email-sync')} className="mt-4">
                  Go to Email Sync
                </Button>
              </>
            ) : (
              <>
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Matches</h3>
                <p className="text-sm text-muted-foreground">
                  No vendors match your search query "{searchQuery}"
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedVendors.map((vendor, index) => (
              <Card
                key={vendor.id}
                className="hover:shadow-lg transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => viewInvoices(vendor.id, vendor.name)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{vendor.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          <span className="text-xs">{formatDate(vendor.createdTime)}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Folder className="h-4 w-4" />
                    <span className="font-mono text-xs truncate">{vendor.id}</span>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      viewInvoices(vendor.id, vendor.name);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Invoices
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {vendorTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={vendorPage === 1}
                onClick={() => setVendorPage(p => Math.max(1, p - 1))}
              >Prev</Button>
              <span className="text-xs text-muted-foreground">Page {vendorPage} of {vendorTotalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={vendorPage === vendorTotalPages}
                onClick={() => setVendorPage(p => Math.min(vendorTotalPages, p + 1))}
              >Next</Button>
            </div>
          )}
        </>
      )}

      {/* Summary Stats */}
      {/* Vendor total count removed per requirement */}
    </div>
  );
};

export default Vendors;
