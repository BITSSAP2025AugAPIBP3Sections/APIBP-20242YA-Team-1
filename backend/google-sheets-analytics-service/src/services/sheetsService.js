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

export const appendInvoiceData = async (invoice) => {
  try {
    const rows = [];

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

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows
      },
    });

    return { success: true, message: "Invoice data with line items added to Google Sheets" };
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

export const exportSheetData = async () => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });

  const rows = response.data.values || [];
  const csvContent = rows.map((r) => r.join(",")).join("\n");

  const filePath = path.join(__dirname, "../exports/expenses.csv");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csvContent);

  return filePath;
};
