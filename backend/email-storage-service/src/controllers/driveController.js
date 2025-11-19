import User from "../models/User.js";
import logger from "../utils/logger.js";
import { listVendorFolders, listVendorInvoices } from "../services/driveService.js";

export const getVendorsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        message: "Missing required parameter: userId.",
        details: "The userId path parameter is required to identify which user's vendors to list.",
        example: "/api/v1/drive/users/690c7d0ee107fb31784c1b1b/vendors"
      });
    }

    // Validate userId format
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid userId format.",
        details: "userId must be a valid 24-character MongoDB ObjectId.",
        providedValue: userId
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found.",
        details: "No user exists with the provided userId. Please complete Google OAuth authentication first.",
        action: "Visit /auth/google to authenticate and create a user account.",
        userId: userId
      });
    }

    if (!user.googleRefreshToken) {
      return res.status(400).json({ 
        message: "Google Drive not connected.",
        details: "This user has not connected their Google account. Google Drive access is required to list vendor folders.",
        action: "Complete OAuth authentication at /auth/google to grant Drive access.",
        userEmail: user.email
      });
    }

    const vendorsResult = await listVendorFolders(user);
    const vendors = Array.isArray(vendorsResult) ? vendorsResult : [];

    return res.status(200).json({
      userId,
      total: vendors.length,
      vendors,
    });
  } catch (error) {
    logger.error(error, { source: "getVendorsByUser" });
    
    let userMessage = "Failed to retrieve vendor folders from Google Drive.";
    let suggestions = [];

    if (error.message?.includes("invalid_grant") || error.message?.includes("Token expired")) {
      userMessage = "Google authentication expired.";
      suggestions = ["Re-authenticate at /auth/google", "Grant permissions again"];
    } else if (error.message?.includes("Folder not found")) {
      userMessage = "Invoice automation folder not found.";
      suggestions = ["Fetch emails first to create the folder structure", "Check if 'invoiceAutomation' folder exists in Drive"];
    }

    return res.status(500).json({
      message: userMessage,
      details: error.message,
      suggestions: suggestions.length > 0 ? suggestions : ["Check server logs for more details", "Verify Google Drive API access"],
      timestamp: new Date().toISOString()
    });
  }
};

export const getInvoicesByVendor = async (req, res) => {
  try {
    const { userId, vendorId } = req.params;

    if (!userId || !vendorId) {
      return res.status(400).json({ 
        message: "Missing required parameters.",
        details: "Both 'userId' and 'vendorId' path parameters are required.",
        example: "/api/v1/drive/users/690c7d0ee107fb31784c1b1b/vendors/1ABC123xyz/invoices",
        providedValues: { userId, vendorId }
      });
    }

    // Validate userId format
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid userId format.",
        details: "userId must be a valid 24-character MongoDB ObjectId.",
        providedValue: userId
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found.",
        details: "No user exists with the provided userId.",
        action: "Verify the userId or authenticate at /auth/google first.",
        userId: userId
      });
    }

    if (!user.googleRefreshToken) {
      return res.status(400).json({ 
        message: "Google Drive not connected.",
        details: "This user has not connected their Google account.",
        action: "Complete OAuth at /auth/google to grant Drive access.",
        userEmail: user.email
      });
    }

    const payload = await listVendorInvoices(user, vendorId);

    return res.status(200).json({
      userId,
      vendorFolderId: payload.vendorFolderId,
      invoiceFolderId: payload.invoiceFolderId,
      total: payload.invoices.length,
      invoices: payload.invoices,
    });
  } catch (error) {
    logger.error(error, { source: "getInvoicesByVendor" });
    
    let userMessage = "Failed to retrieve invoices for this vendor.";
    let suggestions = [];

    if (error.message?.includes("invalid_grant") || error.message?.includes("Token expired")) {
      userMessage = "Google authentication expired.";
      suggestions = ["Re-authenticate at /auth/google"];
    } else if (error.message?.includes("Vendor folder not found") || error.message?.includes("Invalid vendorId")) {
      userMessage = "Vendor folder not found.";
      suggestions = ["Verify the vendorId is correct", "List all vendors first using GET /api/v1/drive/users/:userId/vendors", "Fetch emails first to populate vendor folders"];
    } else if (error.message?.includes("Invoice folder not found")) {
      userMessage = "No invoices folder found for this vendor.";
      suggestions = ["This vendor may not have any invoices yet", "Fetch emails to populate invoices"];
    }

    return res.status(500).json({
      message: userMessage,
      details: error.message,
      suggestions: suggestions.length > 0 ? suggestions : ["Check server logs", "Verify Google Drive access"],
      timestamp: new Date().toISOString()
    });
  }
};
