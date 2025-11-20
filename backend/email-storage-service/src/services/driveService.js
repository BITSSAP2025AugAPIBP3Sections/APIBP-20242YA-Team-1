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

  const rootFolderId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

  const vendorDisplayName = vendor || "Others";
  const vendorFolderName = vendorDisplayName.replace(/[^\w\-\s]/g, "_");
  const vendorFolderId = await findOrCreateFolder(drive, vendorFolderName, rootFolderId);

  const invoiceFolderId = await findOrCreateFolder(drive, "invoices", vendorFolderId);

  const existingFile = await findFileInFolder(drive, invoiceFolderId, fileName);
  if (existingFile) {
    if (!existingFile.webViewLink || !existingFile.webContentLink) {
      const links = await getFileLinks(drive, existingFile.id);
      existingFile.webViewLink = links.webViewLink;
      existingFile.webContentLink = links.webContentLink;
    }
    logger.info(`Skipped duplicate → ${vendorFolderName}/invoices/${fileName}`);
    return {
      fileId: existingFile.id,
      skipped: true,
      vendorFolderId,
      vendorFolderName,
      vendorDisplayName,
      invoiceFolderId,
      webViewLink: existingFile.webViewLink || null,
      webContentLink: existingFile.webContentLink || null,
    };
  }

  const mimeType = getMimeType(fileName);

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [invoiceFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id,name",
  });
  const fileDetails = await getFileLinks(drive, created.data.id);

  logger.info(`Uploaded → ${vendorFolderName}/invoices/${fileName}`);

  return {
    fileId: created.data.id,
    skipped: false,
    vendorFolderId,
    vendorFolderName,
    vendorDisplayName,
    invoiceFolderId,
    webViewLink: fileDetails.webViewLink,
    webContentLink: fileDetails.webContentLink,
  };
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

export const getVendorMasterData = async (user, vendorFolderId) => {
  if (!vendorFolderId) {
    throw new Error("Vendor folder ID is required");
  }

  const drive = buildDriveClient(user);
  const invoiceFolder = await findFolder(drive, "invoices", vendorFolderId);

  if (!invoiceFolder) {
    return {
      vendorFolderId,
      invoiceFolderId: null,
      masterFileId: null,
      updatedAt: null,
      size: null,
      records: [],
      missing: true,
      reason: "invoices_folder_missing",
    };
  }

  const fileQuery = await drive.files.list({
    q: `'${invoiceFolder.id}' in parents and name='master.json' and trashed=false`,
    fields: "files(id,name,modifiedTime,createdTime,size)",
    orderBy: "modifiedTime desc",
    pageSize: 1,
  });

  const masterFile = fileQuery.data.files?.[0];
  if (!masterFile) {
    return {
      vendorFolderId,
      invoiceFolderId: invoiceFolder.id,
      masterFileId: null,
      updatedAt: null,
      size: null,
      records: [],
      missing: true,
      reason: "master_not_found",
    };
  }

  let fileData = null;
  try {
    const { data } = await drive.files.get({
      fileId: masterFile.id,
      alt: "media",
    });
    if (typeof data === "string") {
      fileData = JSON.parse(data);
    } else if (Buffer.isBuffer(data)) {
      fileData = JSON.parse(data.toString("utf-8"));
    } else {
      fileData = data;
    }
  } catch (error) {
    logger.error("Failed to download master.json", {
      fileId: masterFile.id,
      error: error.message,
    });
    return {
      vendorFolderId,
      invoiceFolderId: invoiceFolder.id,
      masterFileId: masterFile.id,
      updatedAt: masterFile.modifiedTime || masterFile.createdTime,
      size: masterFile.size ? Number(masterFile.size) : null,
      records: [],
      missing: true,
      reason: "download_failed",
    };
  }

  let records = [];
  if (Array.isArray(fileData)) {
    records = fileData;
  } else if (fileData && typeof fileData === "object") {
    if (Array.isArray(fileData.records)) {
      records = fileData.records;
    } else {
      records = [fileData];
    }
  }

  return {
    vendorFolderId,
    invoiceFolderId: invoiceFolder.id,
    masterFileId: masterFile.id,
    updatedAt: masterFile.modifiedTime || masterFile.createdTime || null,
    size: masterFile.size ? Number(masterFile.size) : null,
    records,
    missing: false,
  };
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

async function findFileInFolder(drive, folderId, fileName) {
  const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: "files(id,name,webViewLink,webContentLink)",
  });
  return res.data.files?.[0] || null;
}

async function getFileLinks(drive, fileId) {
  try {
    const { data } = await drive.files.get({
      fileId,
      fields: "id,webViewLink,webContentLink",
    });
    return {
      webViewLink: data.webViewLink || null,
      webContentLink: data.webContentLink || null,
    };
  } catch (error) {
    logger.error("Failed to fetch Drive links", {
      fileId,
      error: error.message,
    });
    return {
      webViewLink: null,
      webContentLink: null,
    };
  }
}
