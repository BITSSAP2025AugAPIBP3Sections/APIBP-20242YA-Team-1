import { google } from "googleapis";
import axios from "axios";
import crypto from "crypto";

import User from "../models/User.js";
import { saveToDrive } from "./driveService.js";
import ProcessedAttachment from "../models/ProcessedAttachment.js";
import { detectVendor } from "../utils/vendorDetection.js";
import logger from "../utils/logger.js";

const OCR_BASE_URL = process.env.OCR_SERVICE_BASE_URL || "http://localhost:4003";
const OCR_TOKEN = process.env.OCR_TRIGGER_TOKEN;

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
  const ocrBatches = {}; // { vendorName: { vendorFolderId, invoiceFolderId, invoices: [] } }

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
        // Duplicate prevention: check registry first
        const existing = await ProcessedAttachment.findOne({
          userId: user._id,
          gmailMessageId: msg.id,
          gmailAttachmentId: part.body.attachmentId,
        });

        let uploadResult;
        let fileBuffer; // only fetch and decode if not already processed
        if (existing) {
          logger.info("Reusing previously uploaded attachment", {
            userId,
            vendor,
            filename: part.filename,
            driveFileId: existing.driveFileId,
          });
          uploadResult = {
            fileId: existing.driveFileId,
            skipped: true,
            vendorFolderId: existing.vendorFolderId,
            vendorFolderName: existing.vendor || vendor,
            vendorDisplayName: existing.vendor || vendor,
            invoiceFolderId: existing.invoiceFolderId,
            webViewLink: existing.webViewLink,
            webContentLink: existing.webContentLink,
          };
        } else {
          const attachment = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msg.id,
            id: part.body.attachmentId,
          });
          fileBuffer = Buffer.from(attachment.data.data, "base64");
          try {
            uploadResult = await saveToDrive(user, vendor, fileBuffer, part.filename);
          } catch (error) {
            logger.error("Failed to save attachment to Drive", {
              userId,
              vendor,
              filename: part.filename,
              error: error.message,
            });
            continue;
          }
          // Compute hash for possible future dedup across messages
          let sha256 = null;
          try {
            const hash = crypto.createHash("sha256");
            hash.update(fileBuffer);
            sha256 = hash.digest("hex");
          } catch (_) {}
          try {
            await ProcessedAttachment.create({
              userId: user._id,
              gmailMessageId: msg.id,
              gmailAttachmentId: part.body.attachmentId,
              vendor,
              fileName: part.filename,
              driveFileId: uploadResult.fileId,
              vendorFolderId: uploadResult.vendorFolderId,
              invoiceFolderId: uploadResult.invoiceFolderId,
              webViewLink: uploadResult.webViewLink,
              webContentLink: uploadResult.webContentLink,
              sha256,
            });
          } catch (regErr) {
            logger.error("Failed to persist attachment registry", { regErr: regErr.message });
          }
        }
        const uploadInfo = {
          vendor,
          filename: part.filename,
          path: `${vendor}/invoices/${part.filename}`,
          uploadedAt: new Date().toISOString(),
          fileId: uploadResult.fileId,
          vendorFolderId: uploadResult.vendorFolderId,
          vendorFolderName: uploadResult.vendorFolderName,
          vendorDisplayName: uploadResult.vendorDisplayName,
          invoiceFolderId: uploadResult.invoiceFolderId,
          skipped: uploadResult.skipped,
          webViewLink: uploadResult.webViewLink || null,
          webContentLink: uploadResult.webContentLink || null,
        };
        uploadedFiles.push(uploadInfo);

        if (!uploadResult.skipped) {
          uploadedCount++;
        }

        const vendorKey = uploadResult.vendorFolderId || vendor || "others";
        if (!ocrBatches[vendorKey]) {
          ocrBatches[vendorKey] = {
            vendorName: uploadResult.vendorDisplayName || vendor,
            vendorFolderId: uploadResult.vendorFolderId,
            invoiceFolderId: uploadResult.invoiceFolderId,
            refreshToken: user.googleRefreshToken,
            invoices: [],
          };
        }

        ocrBatches[vendorKey].invoices.push({
          fileId: uploadResult.fileId,
          fileName: part.filename,
          mimeType: "application/pdf",
          webViewLink: uploadResult.webViewLink || null,
          webContentLink: uploadResult.webContentLink || null,
        });

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

  const ocrResults = [];
  if (uploadedCount > 0 && Object.keys(ocrBatches).length > 0) {
    for (const batch of Object.values(ocrBatches)) {
      try {
        const headers = OCR_TOKEN ? { "x-ocr-token": OCR_TOKEN } : {};
        const payload = {
          userId,
          vendorName: batch.vendorName,
          vendorFolderId: batch.vendorFolderId,
          invoiceFolderId: batch.invoiceFolderId,
          refreshToken: batch.refreshToken,
          invoices: batch.invoices,
        };

        const payloadHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex")
          .slice(0, 16);

        const tokenHash = batch.refreshToken
          ? crypto.createHash("sha256").update(batch.refreshToken).digest("hex").slice(0, 16)
          : "";

        logger.info("Triggering OCR request", {
          userId,
          vendorName: batch.vendorName,
          invoiceCount: batch.invoices.length,
          payloadHash,
          refreshTokenHash: tokenHash,
          headers: Object.keys(headers).length ? Object.keys(headers) : "none",
          url: `${OCR_BASE_URL}/api/v1/processing/vendor`,
        });

        const response = await axios.post(
          `${OCR_BASE_URL}/api/v1/processing/vendor`,
          payload,
          {
            headers,
            timeout: 30000,
          }
        );
        logger.info("OCR request completed", {
          userId,
          vendorName: batch.vendorName,
          invoiceCount: batch.invoices.length,
          payloadHash,
          refreshTokenHash: tokenHash,
          responseStatus: response.status,
        });

        ocrResults.push({ vendorName: batch.vendorName, status: response.data });
      } catch (error) {
        logger.error("Failed to trigger OCR", {
          userId,
          vendorName: batch.vendorName,
          error: error.response?.data || error.message,
        });
        ocrResults.push({
          vendorName: batch.vendorName,
          status: "failed",
          error: error.response?.data || error.message,
        });
      }
    }
  }

  return { 
    totalProcessed: emails.length,
    filesUploaded: uploadedCount,
    uploadedFiles: uploadedFiles,
    vendorsDetected: Array.from(vendorsDetected),
    ocrTriggers: ocrResults,
  };
};
