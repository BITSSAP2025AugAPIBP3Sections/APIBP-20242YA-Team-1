// src/services/driveSheetService.js
import { google } from "googleapis";
import logger from "../utils/logger.js";

function buildOauthClientFromUser() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_REFRESH_TOKEN missing in .env");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

/**
 * Process all vendors under root folder invoiceAutomation.
 * For each vendor:
 *  - find master.json
 *  - parse it (expected to be an array of invoices or object with records)
 *  - ensure sheet exists in vendor folder (create if missing)
 *  - append rows to sheet (write headers if new)
 *
 * Returns summary for each vendor.
 */
export const processDriveVendors = async () => {
  const auth = buildOauthClientFromUser();  // FIXED
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  // 1. find root folder invoiceAutomation
  const rootFolder = await findFolder(drive, "invoiceAutomation");
  if (!rootFolder) {
    return { success: false, message: "Root folder 'invoiceAutomation' not found. Please sync your email", processed: [] };
  }

  // 2. list vendor folders inside root
  const vendorFolders = await listFoldersInParent(drive, rootFolder.id);

  const processed = [];
  for (const vf of vendorFolders) {
    try {
      const vendorName = vf.name;
      const vendorFolderId = vf.id;

      // find master.json (exact match)
      const masterFile = await findFileByNameInFolder(drive, vendorFolderId, "master.json");
      if (!masterFile) {
        processed.push({
          vendorName,
          vendorFolderId,
          status: "no_master_json",
        });
        continue;
      }

      // download master.json content
      const jsonData = await downloadJsonFile(drive, masterFile.id);

      // normalize into invoices array (compatible with your appendInvoiceData input)
      const invoices = normalizeMasterJson(jsonData);

      if (!Array.isArray(invoices) || invoices.length === 0) {
        processed.push({
          vendorName,
          vendorFolderId,
          masterFileId: masterFile.id,
          status: "no_records",
        });
        continue;
      }

      // check for existing spreadsheet in vendor folder
      const sheetFile = await findSpreadsheetInFolder(drive, vendorFolderId);

      let spreadsheetId;
      let createdNew = false;
      if (!sheetFile) {
        // create a Google Sheet in that vendor folder (via Drive create)
        const newSheet = await drive.files.create({
          requestBody: {
            name: `${vendorName}-expenses`,
            mimeType: "application/vnd.google-apps.spreadsheet",
            parents: [vendorFolderId],
          },
          fields: "id,name",
        });
        spreadsheetId = newSheet.data.id;
        createdNew = true;
        logger?.info?.(`Created spreadsheet ${vendorName}-expenses (${spreadsheetId}) in folder ${vendorName}`);
      } else {
        spreadsheetId = sheetFile.id;
      }

      // If created new, write header row. We'll write to Sheet1.
      if (createdNew) {
        const header = [
          [
            "vendor_name",
            "invoice_number",
            "invoice_date",
            "total_amount",
            "item_description",
            "quantity",
            "unit_price",
            "amount",
          ],
        ];
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1:H1",
          valueInputOption: "USER_ENTERED",
          requestBody: { values: header },
        });
      }

      // Prepare rows from invoices
      const rows = buildRowsFromInvoices(invoices);

      if (rows.length === 0) {
        processed.push({
          vendorName,
          vendorFolderId,
          spreadsheetId,
          status: "no_rows_generated",
          records: 0,
        });
        continue;
      }

      // Append rows into spreadsheet (Sheet1)
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:H",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });

      processed.push({
        vendorName,
        vendorFolderId,
        masterFileId: masterFile.id,
        spreadsheetId,
        status: "ok",
        recordsInserted: rows.length,
        createdNew,
      });
    } catch (err) {
      logger?.error?.("Error processing vendor", { vendorFolder: vf, error: err.message });
      processed.push({
        vendorName: vf.name,
        vendorFolderId: vf.id,
        status: "error",
        error: err.message,
      });
    }
  } // end for vendorFolders

  return { success: true, message: "Processed vendors", processed };
};

/* ---------- helper functions ---------- */

async function findFolder(drive, folderName, parentId = null) {
  const q = parentId
    ? `'${parentId}' in parents and name='${escapeForQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${escapeForQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q, fields: "files(id,name,createdTime,modifiedTime)", pageSize: 1 });
  return res.data.files?.[0] || null;
}

async function listFoldersInParent(drive, parentId) {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name,createdTime,modifiedTime)",
    orderBy: "name_natural",
    pageSize: 1000,
  });
  return res.data.files || [];
}

async function findFileByNameInFolder(drive, folderId, fileName) {
  const q = `'${folderId}' in parents and name='${escapeForQuery(fileName)}' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name,mimeType,createdTime,modifiedTime,size)",
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}

async function findSpreadsheetInFolder(drive, folderId) {
  const q = `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name,createdTime,modifiedTime)",
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}

async function downloadJsonFile(drive, fileId) {
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  // accumulate stream
  return new Promise((resolve, reject) => {
    let data = "";
    res.data.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    res.data.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (err) {
        reject(new Error("Failed to parse JSON from Drive file: " + err.message));
      }
    });
    res.data.on("error", (err) => reject(err));
  });
}

function normalizeMasterJson(jsonData) {
  // Accept either:
  // - an array (of invoices)
  // - an object with { records: [...] }
  // - a single invoice object
  if (!jsonData) return [];
  if (Array.isArray(jsonData)) return jsonData;
  if (jsonData.records && Array.isArray(jsonData.records)) return jsonData.records;
  return [jsonData];
}

function buildRowsFromInvoices(invoices) {
  const rows = [];
  invoices.forEach((invoice) => {
    if (!invoice.line_items || !Array.isArray(invoice.line_items)) return;
    invoice.line_items.forEach((item) => {
      rows.push([
        invoice.vendor_name || "",
        invoice.invoice_number || "",
        invoice.invoice_date || "",
        invoice.total_amount || "",
        item.item_description || "",
        item.quantity || "",
        item.unit_price || "",
        item.amount || "",
      ]);
    });
  });
  return rows;
}

// Escape single quotes used in Drive query strings
function escapeForQuery(str) {
  return str.replace(/'/g, "\\'");
}
