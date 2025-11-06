import { google } from "googleapis";
import User from "../models/User.js";
import { saveToDrive } from "./driveService.js";
import { detectVendor } from "../utils/vendorDetection.js";

export const fetchAndProcessEmails = async (userId, fromDate) => {
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
    ? Math.floor(new Date(user.lastSyncedAt).getTime() / 1000) // convert to Gmail timestamp
    : Math.floor(new Date(fromDate).getTime() / 1000); // first time sync

  const response = await gmail.users.messages.list({
    userId: "me",
    q: `after:${fetchFrom} has:attachment filename:pdf`,
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

    const parts = message.data.payload.parts || [];
    for (const part of parts) {
      if (
        part.filename &&
        part.body.attachmentId &&
        part.filename.toLowerCase().endsWith(".pdf")
      ) {
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
