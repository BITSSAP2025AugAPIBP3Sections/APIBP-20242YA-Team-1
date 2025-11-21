import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
console.log("SPREADSHEET_ID from env:", process.env.SPREADSHEET_ID);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Expenses"; // Make sure your sheet has this tab

export const appendInvoiceData = async (invoices) => {
  try {
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
          item.amount || ""
        ]);
      });
    });

    if (rows.length === 0) {
      return { success: false, message: "No invoice data found to append" };
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    return {
      success: true,
      message: "Invoice data added to Google Sheets",
      rowsInserted: rows.length
    };
  } catch (error) {
    console.error("Error appending to sheet:", error);
    return { success: false, error: error.message };
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const data = await fetchAnalyticsData();
    res.status(200).json({
      success: true,
      message: "Analytics retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error while retrieving analytics",
      error: error.message,
    });
  }
};

export const exportSheetData = async (format = "csv") => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      throw new Error("No data found in the sheet");
    }

    const exportDir = path.join(__dirname, "../exports");
    fs.mkdirSync(exportDir, { recursive: true });

    let filePath;

    if (format === "csv") {
      filePath = path.join(exportDir, "expenses.csv");
      const csvContent = rows.map((r) => r.join(",")).join("\n");
      fs.writeFileSync(filePath, csvContent);
    }

    else if (format === "json") {
      filePath = path.join(exportDir, "expenses.json");
      const [headers, ...data] = rows;

      const jsonData = data.map((row) =>
        Object.fromEntries(
          headers.map((key, idx) => [key || `column_${idx+1}`, row[idx] || ""])
        )
      );

      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    }

    else {
      throw new Error("Unsupported export format. Use 'csv' or 'json'.");
    }

    return filePath;
  } catch (error) {
    console.error("Error exporting sheet data:", error);
    throw error;
  }
};
// near top or bottom of src/services/sheetsService.js
export function buildRowsFromInvoices(invoices) {
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
        item.amount || ""
      ]);
    });
  });
  return rows;
}
