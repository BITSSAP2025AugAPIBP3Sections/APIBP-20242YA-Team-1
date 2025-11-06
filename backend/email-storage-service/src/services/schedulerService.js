import cron from "node-cron";
import { fetchAndProcessEmails } from "./gmailService.js";

// Store scheduled jobs to prevent duplicates
const scheduledJobs = {};

/**
 * Schedule automatic email fetching
 * @param {string} userId 
 * @param {string} fromDate 
 * @param {string} frequency (hourly, daily, weekly)
 * @param {object} filters (email, vendor, onlyPdf)
 */
export default function scheduleEmailJob(userId, fromDate, frequency, filters) {
  // If already scheduled → avoid duplication
  if (scheduledJobs[userId]) {
    console.log(`Job for user ${userId} already exists. Skipping new schedule.`);
    return;
  }

  let cronTime;

  switch (frequency) {
    case "minute":
        cronTime = "* * * * *";
        break;                          // Every minute
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
    console.log(`⏳ Running scheduled email fetch for user ${userId}...`);
    try {
      await fetchAndProcessEmails(userId, fromDate, filters);
      console.log(`✅ Emails processed successfully for user ${userId}`);
    } catch (err) {
      console.error(`❌ Error during scheduled email fetch: `, err);
    }
  });

  scheduledJobs[userId] = job;
  job.start();

  console.log(`✅ Scheduled job for user ${userId}, running ${frequency}`);
}
