import { google } from "googleapis";
import { Readable } from "stream";
import logger from "../utils/logger.js";

const ROOT_FOLDER_NAME = "invoiceAutomation";

function buildDriveClient(user) {
  if (!user?.googleRefreshToken) {
    throw new Error("User does not have a Google refresh token");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

export const saveToDrive = async (user, vendor, fileBuffer, fileName) => {
  const drive = buildDriveClient(user);

  // Parent folder: invoiceAutomation
  const rootFolderId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

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

export const listVendorFolders = async (user) => {
  const drive = buildDriveClient(user);
  const rootFolder = await findFolder(drive, ROOT_FOLDER_NAME);

  if (!rootFolder) {
    return [];
  }

  const res = await drive.files.list({
    q: `'${rootFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name,createdTime,modifiedTime)",
    orderBy: "name_natural",
  });

  return (res.data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
  }));
};

export const listVendorInvoices = async (user, vendorFolderId) => {
  if (!vendorFolderId) {
    throw new Error("Vendor folder ID is required");
  }

  const drive = buildDriveClient(user);
  const invoiceFolder = await findFolder(drive, "invoices", vendorFolderId);

  if (!invoiceFolder) {
    return { vendorFolderId, invoiceFolderId: null, invoices: [] };
  }

  const res = await drive.files.list({
    q: `'${invoiceFolder.id}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,webContentLink,size)",
    orderBy: "name_natural",
  });

  const invoices = (res.data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : null,
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink || null,
    webContentLink: file.webContentLink || null,
  }));

  return { vendorFolderId, invoiceFolderId: invoiceFolder.id, invoices };
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

async function findFolder(drive, folderName, parentId = null) {
  const query = parentId
    ? `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({ q: query, fields: "files(id,name,createdTime,modifiedTime)" });
  return res.data.files?.[0] || null;
}
