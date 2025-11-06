import { fetchAndProcessEmails } from "../services/gmailService.js";
import scheduleEmailJob from "../services/schedulerService.js"; // Only if scheduling is used
import User from "../models/User.js";

export const fetchEmailsController = async (req, res) => {
  try {
    const { 
      userId, 
      fromDate, 
      schedule = "manual",   // Default manual mode
      vendor, 
      email, 
      onlyPdf = true         // Default: only PDF files
    } = req.body;

    // ✅ Required fields check
    if (!userId || !fromDate || !vendor) {
      return res.status(400).json({
        message: "userId, fromDate, and vendor are required."
      });
    }

    // Ensure user exists
    const dbUser = await User.findById(userId);
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Manual Fetch Immediately
    if (schedule === "manual") {
      const result = await fetchAndProcessEmails(userId, fromDate, { vendor, email, onlyPdf });
      return res.status(200).json({
        message: "Manual invoice fetch completed.",
        filtersUsed: { vendor, email, onlyPdf, fromDate },
        result,
      });
    }

    // ✅ Scheduled (Auto Fetch using cron)
    if (schedule?.type === "auto" && schedule?.frequency) {
      scheduleEmailJob(userId, fromDate, schedule.frequency, { vendor, email, onlyPdf });
      return res.status(200).json({
        message: `Emails will now be fetched automatically every ${schedule.frequency}.`,
        filtersUsed: { vendor, email, onlyPdf, fromDate }
      });
    }

    // If schedule is not valid
    return res.status(400).json({ message: "Invalid schedule format! Use 'manual' or { type: 'auto', frequency: 'daily/hourly' }" });

  } catch (error) {
    console.error("Error in fetchEmailsController:", error);
    return res.status(500).json({
      message: "Failed to fetch emails.",
      error: error.message,
    });
  }
};
