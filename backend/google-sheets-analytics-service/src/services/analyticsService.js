import { sheets } from "./sheetsService.js";
import dotenv from "dotenv";
dotenv.config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Expenses";

export const fetchAnalyticsData = async () => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`,
  });

  const rows = response.data.values || [];
  if (rows.length < 2) {
    return { message: "No data available in sheet" };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const totalRecords = dataRows.length;

  let totalAmount = 0;
  const vendorCount = {};

  dataRows.forEach((row) => {
    const vendor = row[0] || "Unknown Vendor";
    const amount = parseFloat(row[7]) || 0;

    totalAmount += amount;
    vendorCount[vendor] = (vendorCount[vendor] || 0) + amount;
  });

  return {
    totalRecords,
    totalAmount,
    expensesByVendor: vendorCount,
  };
};
