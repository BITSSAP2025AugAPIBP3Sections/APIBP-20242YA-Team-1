import { google } from "googleapis";
import { Readable } from "stream";
import logger from "../utils/logger.js";

export const saveToDrive = async (user, vendor, fileBuffer, fileName) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Parent folder: invoiceAutomation
  const rootFolderId = await findOrCreateFolder(drive, "invoiceAutomation");

  // Vendor folder: invoiceAutomation/{Vendor}
  const safeVendor = (vendor || "Others").replace(/[^\w\-\s]/g, "_");
  const vendorFolderId = await findOrCreateFolder(drive, safeVendor, rootFolderId);

  // Invoices subfolder
  const invoiceFolderId = await findOrCreateFolder(drive, "invoices", vendorFolderId);

  // Determine mime type from filename
  const mimeType = getMimeType(fileName);

  // Upload file as a Readable stream (avoids .pipe error)
  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [invoiceFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
  });

  logger.info(`Uploaded → ${safeVendor}/invoices/${fileName}`);

};

function getMimeType(fileName = "") {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

// Helper function
async function findOrCreateFolder(drive, folderName, parentId = null) {
  const query = parentId
    ? `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({ q: query, fields: "files(id,name)" });

  if (res.data.files.length > 0) return res.data.files[0].id;

  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentId ? [parentId] : [],
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });

  return folder.data.id;
}
