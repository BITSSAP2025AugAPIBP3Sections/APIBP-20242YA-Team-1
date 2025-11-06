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

  const fetchFrom = user.lastSyncedAt
    ? Math.floor(new Date(user.lastSyncedAt).getTime() / 1000)
    : Math.floor(new Date(fromDate).getTime() / 1000);

  const { vendor: vendorFilter, email: emailFilter, onlyPdf = true } = filters || {};

  // Build Gmail search query
  let query = `after:${fetchFrom} has:attachment`;
  if (onlyPdf) {
    query += ` filename:pdf`;
  } else {
    query += ` (filename:pdf OR filename:jpg OR filename:jpeg OR filename:png)`;
  }
  if (emailFilter) {
    query += ` from:${emailFilter}`;
  }

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
  });

  const emails = response.data.messages || [];

  for (const msg of emails) {
    const message = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
    });

    const headers = message.data.payload.headers;
    const fromHeader =
      headers.find((h) => h.name === "From")?.value || "Unknown";
    const vendor = detectVendor(fromHeader);

    // If a vendor filter is specified, skip non-matching vendors
    if (vendorFilter && vendor !== vendorFilter) {
      logger.debug("Skipping message due to vendor filter", { vendor, vendorFilter, messageId: msg.id });
      continue;
    }

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
        await saveToDrive(user, vendor, fileBuffer, part.filename);
      }
    }
  }

  await User.findByIdAndUpdate(userId, {
    lastSyncedAt: new Date()  // Store current time as last successful sync
  });


  return { totalProcessed: emails.length };
};
