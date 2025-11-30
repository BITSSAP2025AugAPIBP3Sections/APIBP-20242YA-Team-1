import { fetchAndProcessEmails } from "../services/gmailService.js";
import scheduleEmailJob, { getScheduledJobs, cancelScheduledJob } from "../services/schedulerService.js";
import User from "../models/User.js";

// ===============================================
// IN-MEMORY JOB STORE (for manual fetch tracking)
// ===============================================
const jobStore = new Map();

function createJob(userId, filters) {
  const jobId = `${userId}_${Date.now()}`;
  jobStore.set(jobId, {
    jobId,
    userId,
    status: "processing",
    filters,
    createdAt: new Date().toISOString(),
    result: null,
    error: null
  });
  return jobId;
}

function updateJobSuccess(jobId, result) {
  const job = jobStore.get(jobId);
  if (job) {
    job.status = "completed";
    job.result = result;
    job.completedAt = new Date().toISOString();
  }
}

function updateJobError(jobId, error) {
  const job = jobStore.get(jobId);
  if (job) {
    job.status = "failed";
    job.error = error;
    job.completedAt = new Date().toISOString();
  }
}

export function getJobStatus(jobId) {
  return jobStore.get(jobId) || null;
}

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
        details: "Provide a valid MongoDB ObjectId for userId and a date or datetime (YYYY-MM-DD or ISO timestamp).",
        example: {
          userId: "690c7d0ee107fb31784c1b1b",
          fromDate: "2024-01-01T10:30:00Z"
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

    // Manual Fetch - NOW ASYNC WITH JOB TRACKING
    if (schedule === "manual") {
      const filters = { 
        emails: emailList, 
        emailCount: emailList ? emailList.length : 0, 
        onlyPdf, 
        fromDate, 
        forceSync 
      };
      
      const jobId = createJob(userId, filters);
      
      // Process in background
      setImmediate(async () => {
        try {
          const result = await fetchAndProcessEmails(userId, fromDate, { emails: emailList, onlyPdf, forceSync });
          updateJobSuccess(jobId, result);
          console.log(`✅ Job ${jobId} completed successfully`);
        } catch (error) {
          console.error(`❌ Job ${jobId} failed:`, error.message);
          updateJobError(jobId, {
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Return immediately with jobId
      return res.status(202).json({
        message: "Email fetch job started. Use the jobId to check status.",
        jobId,
        filtersUsed: filters,
        statusEndpoint: `/api/v1/email/jobs/${jobId}`
      });
    }

    // Scheduled (Auto Fetch using cron)
    if (schedule?.type === "auto" && schedule?.frequency) {
      const jobId = scheduleEmailJob(userId, fromDate, schedule.frequency, { emails: emailList, onlyPdf, forceSync });
      return res.status(200).json({
        message: `Emails will now be fetched automatically every ${schedule.frequency}.`,
        jobId: jobId,
        filtersUsed: { emails: emailList, emailCount: emailList ? emailList.length : 0, onlyPdf, fromDate, forceSync }
      });
    }

    // Invalid schedule
    return res.status(400).json({ 
      message: "Invalid schedule format.",
      details: "The 'schedule' parameter must be either 'manual' or an object with 'type' and 'frequency'.",
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
    let userMessage = "Failed to fetch and process emails.";
    let details = error.message;
    let suggestions = [];

    if (error.message?.includes("No Gmail connected")) {
      userMessage = "Gmail connection error.";
      details = "Unable to access Gmail API. The user's Google refresh token may be invalid or expired.";
      suggestions = ["Re-authenticate by visiting /auth/google", "Check if Google account permissions are still granted"];
    } else if (error.message?.includes("Invalid date")) {
      userMessage = "Invalid date format.";
      details = "The 'fromDate' value could not be parsed.";
      suggestions = ["Use format YYYY-MM-DD or a valid ISO datetime", "Ensure the date is not in the future"];
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

/**
 * Get job status by jobId
 */
export const getJobStatusController = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required.",
        details: "Please provide a valid job ID to check status."
      });
    }

    const job = getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({
        message: "Job not found.",
        details: `No job found with ID ${jobId}. It may have expired or never existed.`,
        jobId
      });
    }

    return res.status(200).json(job);

  } catch (error) {
    console.error("Error in getJobStatusController:", error);
    return res.status(500).json({
      message: "Failed to retrieve job status.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get all scheduled jobs for a user
 */
export const getScheduledJobsController = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !/^[a-f0-9]{24}$/.test(userId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
        details: "User ID must be a valid 24-character hexadecimal MongoDB ObjectId.",
        providedValue: userId
      });
    }

    const jobs = getScheduledJobs(userId);
    return res.status(200).json({
      message: "Scheduled jobs retrieved successfully.",
      count: jobs.length,
      jobs: jobs
    });

  } catch (error) {
    console.error("Error in getScheduledJobsController:", error);
    return res.status(500).json({
      message: "Failed to retrieve scheduled jobs.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Cancel a scheduled job
 */
export const cancelScheduledJobController = async (req, res) => {
  try {
    const { userId, jobId } = req.params;

    if (!userId || !/^[a-f0-9]{24}$/.test(userId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
        details: "User ID must be a valid 24-character hexadecimal MongoDB ObjectId.",
        providedValue: userId
      });
    }

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required.",
        details: "Please provide a valid job ID to cancel."
      });
    }

    const success = cancelScheduledJob(userId, jobId);
    
    if (success) {
      return res.status(200).json({
        message: "Scheduled job cancelled successfully.",
        jobId: jobId
      });
    } else {
      return res.status(404).json({
        message: "Scheduled job not found.",
        details: `No job found with ID ${jobId} for user ${userId}.`,
        suggestions: ["Verify the job ID is correct", "Check if the job was already cancelled"]
      });
    }

  } catch (error) {
    console.error("Error in cancelScheduledJobController:", error);
    return res.status(500).json({
      message: "Failed to cancel scheduled job.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
