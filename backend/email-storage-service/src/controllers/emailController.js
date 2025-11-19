import { fetchAndProcessEmails } from "../services/gmailService.js";
import scheduleEmailJob from "../services/schedulerService.js"; // Only if scheduling is used
import User from "../models/User.js";

export const fetchEmailsController = async (req, res) => {
  try {
    const { 
      userId, 
      fromDate, 
      schedule = "manual",   // Default manual mode
      email,                 // Filter by vendor email address(es) - comma-separated
      onlyPdf = true,        // Default: only PDF files
      forceSync = false      // Force sync from fromDate instead of lastSyncedAt
    } = req.body;

    // Parse email parameter - support comma-separated multiple emails
    let emailList = null;
    if (email) {
      emailList = email.split(',').map(e => e.trim()).filter(e => e.length > 0);
    }

    // Required fields check
    if (!userId || !fromDate) {
      return res.status(400).json({
        message: "Missing required fields: 'userId' and 'fromDate' are required.",
        details: "Please provide a valid MongoDB ObjectId for userId and a date in YYYY-MM-DD format for fromDate.",
        example: {
          userId: "690c7d0ee107fb31784c1b1b",
          fromDate: "2024-01-01"
        }
      });
    }

    // Validate userId format
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid userId format.",
        details: "userId must be a valid 24-character MongoDB ObjectId (hexadecimal).",
        providedValue: userId
      });
    }

    // Ensure user exists
    const dbUser = await User.findById(userId);
    if (!dbUser) {
      return res.status(404).json({ 
        message: "User not found in the database.",
        details: "The provided userId does not match any registered user. Please complete Google OAuth authentication first by visiting /auth/google.",
        userId: userId
      });
    }

    // Check if user has Google connection
    if (!dbUser.googleRefreshToken) {
      return res.status(400).json({
        message: "Google account not connected.",
        details: "This user has not completed Google OAuth authentication. Please authenticate at /auth/google to grant Gmail and Drive access.",
        action: "Visit http://localhost:4002/auth/google to connect your Google account."
      });
    }

    // Log request details
    console.log("Fetch request:", { 
      userId, 
      fromDate, 
      emails: emailList || "ALL", 
      emailCount: emailList ? emailList.length : 0,
      onlyPdf,
      forceSync,
      lastSyncedAt: dbUser.lastSyncedAt 
    });

    //  Manual Fetch Immediately
    if (schedule === "manual") {
      const result = await fetchAndProcessEmails(userId, fromDate, { emails: emailList, onlyPdf, forceSync });
      return res.status(200).json({
        message: "Manual invoice fetch completed.",
        filtersUsed: { emails: emailList, emailCount: emailList ? emailList.length : 0, onlyPdf, fromDate, forceSync },
        result,
      });
    }

    // Scheduled (Auto Fetch using cron)
    if (schedule?.type === "auto" && schedule?.frequency) {
      scheduleEmailJob(userId, fromDate, schedule.frequency, { emails: emailList, onlyPdf, forceSync });
      return res.status(200).json({
        message: `Emails will now be fetched automatically every ${schedule.frequency}.`,
        filtersUsed: { emails: emailList, emailCount: emailList ? emailList.length : 0, onlyPdf, fromDate, forceSync }
      });
    }

    // If schedule is not valid
    return res.status(400).json({ 
      message: "Invalid schedule format.",
      details: "The 'schedule' parameter must be either 'manual' for immediate execution, or an object with 'type' and 'frequency' for automated scheduling.",
      validFormats: [
        "manual",
        { type: "auto", frequency: "hourly" },
        { type: "auto", frequency: "daily" },
        { type: "auto", frequency: "weekly" }
      ],
      providedValue: schedule
    });

  } catch (error) {
    console.error("Error in fetchEmailsController:", error);
    
    // Provide specific error messages based on error type
    let userMessage = "Failed to fetch and process emails.";
    let details = error.message;
    let suggestions = [];

    if (error.message?.includes("No Gmail connected")) {
      userMessage = "Gmail connection error.";
      details = "Unable to access Gmail API. The user's Google refresh token may be invalid or expired.";
      suggestions = ["Re-authenticate by visiting /auth/google", "Check if Google account permissions are still granted"];
    } else if (error.message?.includes("Invalid date")) {
      userMessage = "Invalid date format.";
      details = "The 'fromDate' parameter must be in YYYY-MM-DD format.";
      suggestions = ["Use format: 2024-01-01", "Ensure the date is valid and not in the future"];
    } else if (error.message?.includes("Rate limit")) {
      userMessage = "Gmail API rate limit exceeded.";
      details = "Too many requests to Gmail API. Please wait before retrying.";
      suggestions = ["Wait 1-2 minutes before retrying", "Reduce the frequency of email fetches"];
    }

    return res.status(500).json({
      message: userMessage,
      details: details,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      timestamp: new Date().toISOString()
    });
  }
};
