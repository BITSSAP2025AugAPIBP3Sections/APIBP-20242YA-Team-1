import cron from "node-cron";
import { fetchAndProcessEmails } from "./gmailService.js";
import logger from "../utils/logger.js";

// Store scheduled jobs with metadata
const scheduledJobs = {};

/**
 * Get all scheduled jobs for a user
 */
export function getScheduledJobs(userId) {
  const userJobs = Object.entries(scheduledJobs)
    .filter(([jobId]) => jobId.startsWith(userId))
    .map(([jobId, jobData]) => ({
      jobId,
      userId: jobData.userId,
      filters: jobData.filters,
      frequency: jobData.frequency,
      createdAt: jobData.createdAt,
      status: "active"
    }));
  
  return userJobs;
}

/**
 * Cancel a specific scheduled job
 */
export function cancelScheduledJob(userId, jobId) {
  if (scheduledJobs[jobId]) {
    scheduledJobs[jobId].job.stop();
    delete scheduledJobs[jobId];
    logger.info(`Cancelled scheduled job ${jobId} for user ${userId}`);
    return true;
  }
  return false;
}

/**
 * Schedule automatic email fetching
 * @param {string} userId 
 * @param {string} fromDate 
 * @param {string} frequency (hourly, daily, weekly)
 * @param {object} filters (email, vendor, onlyPdf)
 */
export default function scheduleEmailJob(userId, fromDate, frequency, filters) {
  // Generate unique job ID
  const jobId = `${userId}_${Date.now()}_${frequency}`;
  
  // Check if this exact job already exists
  if (scheduledJobs[jobId]) {
    logger.warn(`Job ${jobId} already exists. Skipping new schedule.`);
    return jobId;
  }

  let cronTime;

  switch (frequency) {
    case "minute":
        cronTime = "* * * * *";
        break;                         // Every minute at :00
    case "hourly":
      cronTime = "0 * * * *";          // Every hour at minute 0
      break;
    case "daily":
      cronTime = "0 9 * * *";          // Every day at 9 AM
      break;
    case "weekly":
      cronTime = "0 9 * * MON";        // Every Monday at 9 AM
      break;
    default:
      throw new Error("Invalid scheduling frequency");
  }

  // Create scheduled job
  const job = cron.schedule(cronTime, async () => {
    logger.info(`Running scheduled email fetch for user ${userId}`, { jobId });
    try {
      await fetchAndProcessEmails(userId, fromDate, filters);
      logger.info(`Emails processed successfully for user ${userId}`, { jobId });
    } catch (err) {
      logger.error(err, { userId, jobId, phase: "scheduledFetch" });
    }
  });

  // Store job with metadata
  scheduledJobs[jobId] = {
    job,
    userId,
    filters: { ...filters, fromDate },
    frequency,
    createdAt: new Date().toISOString()
  };
  
  job.start();

  logger.info(`Scheduled job for user ${userId}`, { jobId, frequency });
  
  return jobId;
}
