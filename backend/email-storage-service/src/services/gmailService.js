import { google } from "googleapis";
import User from "../models/User.js";
import { saveToDrive } from "./driveService.js";
import { detectVendor } from "../utils/vendorDetection.js";
import logger from "../utils/logger.js";

export const fetchAndProcessEmails = async (userId, fromDate, filters) => {
  const user = await User.findById(userId);
  if (!user || !user.googleRefreshToken) throw new Error("No Gmail connected");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const { emails: emailList, onlyPdf = true, forceSync = false } = filters || {};

  // Determine fetch date: use fromDate if forceSync=true or lastSyncedAt is null
  const fetchFrom = (forceSync || !user.lastSyncedAt)
    ? Math.floor(new Date(fromDate).getTime() / 1000)
    : Math.floor(new Date(user.lastSyncedAt).getTime() / 1000);

  // Build Gmail search query
  let query = `after:${fetchFrom} has:attachment`;
  if (onlyPdf) {
    query += ` filename:pdf`;
  } else {
    query += ` (filename:pdf OR filename:jpg OR filename:jpeg OR filename:png)`;
  }
  
  // Support multiple email addresses with OR logic
  if (emailList && emailList.length > 0) {
    if (emailList.length === 1) {
      query += ` from:${emailList[0]}`;
    } else {
      const emailQuery = emailList.map(e => `from:${e}`).join(' OR ');
      query += ` (${emailQuery})`;
    }
  }

  logger.info(`Gmail search query: ${query}`, { 
    userId, 
    fetchFrom: new Date(fetchFrom * 1000).toISOString(),
    emailFilters: emailList || "ALL",
    emailCount: emailList ? emailList.length : 0,
    forceSync,
    lastSyncedAt: user.lastSyncedAt 
  });

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
  });

  const emails = response.data.messages || [];
  logger.info(`Found ${emails.length} emails matching query`, { userId, query });

  if (emails.length === 0) {
    logger.warn("No emails found matching the search criteria", { 
      userId, 
      query, 
      fetchFrom: new Date(fetchFrom * 1000).toISOString(),
      lastSyncedAt: user.lastSyncedAt 
    });
  }

  let uploadedCount = 0;
  const uploadedFiles = []; // Track uploaded files details
  const vendorsDetected = new Set();

  for (const msg of emails) {
    const message = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
    });

    const headers = message.data.payload.headers;
    const fromHeader =
      headers.find((h) => h.name === "From")?.value || "Unknown";
    const subjectHeader = 
      headers.find((h) => h.name === "Subject")?.value || "";
    const vendor = detectVendor(fromHeader, subjectHeader);
    vendorsDetected.add(vendor);

    const parts = message.data.payload.parts || [];
    for (const part of parts) {
      if (
        part.filename &&
        part.body.attachmentId
      ) {
        // Honor onlyPdf flag
        const lower = (part.filename || "").toLowerCase();
        const isAllowed = onlyPdf ? lower.endsWith(".pdf") : /\.(pdf|jpg|jpeg|png)$/.test(lower);
        if (!isAllowed) continue;
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: msg.id,
          id: part.body.attachmentId,
        });

        const fileBuffer = Buffer.from(attachment.data.data, "base64");
        const drivePath = await saveToDrive(user, vendor, fileBuffer, part.filename);
        uploadedCount++;
        
        const uploadInfo = {
          vendor,
          filename: part.filename,
          path: `${vendor}/invoices/${part.filename}`,
          uploadedAt: new Date().toISOString()
        };
        uploadedFiles.push(uploadInfo);
        
        logger.info(`Uploaded file ${uploadedCount}`, { vendor, filename: part.filename });
      }
    }
  }

  await User.findByIdAndUpdate(userId, {
    lastSyncedAt: new Date()  // Store current time as last successful sync
  });

  logger.info("Email fetch completed", { 
    userId, 
    totalEmailsProcessed: emails.length, 
    filesUploaded: uploadedCount 
  });

  return { 
    totalProcessed: emails.length,
    filesUploaded: uploadedCount,
    uploadedFiles: uploadedFiles,
    vendorsDetected: Array.from(vendorsDetected)
  };
};
