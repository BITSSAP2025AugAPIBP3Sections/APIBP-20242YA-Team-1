import { sheets } from "./sheetsService.js";
import dotenv from "dotenv";
dotenv.config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Expenses";

export const fetchAnalyticsData = async () => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`, // Adjust if you have more columns
  });

  const rows = response.data.values || [];
  if (rows.length < 2) {
    return { message: "No data available in sheet" };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const totalRecords = dataRows.length;

  let totalAmount = 0;
  let totalInvoiceCount = 0;
  const vendorSpend = {};
  const categorySpend = {};
  const monthlySpend = {};
  const quarterlySpend = {};
  let totalPaymentDays = 0;
  let previousTotalAmount = 0; // For cost reduction (if historical data exists)

  dataRows.forEach((row) => {
    const vendor = row[0] || "Unknown Vendor";
    const category = row[1] || "Uncategorized"; // Assuming column B is category
    const invoiceAmount = parseFloat(row[7]) || 0; // Amount column
    const invoiceDateStr = row[2]; // Assuming column C is invoice date
    const paymentDateStr = row[3]; // Assuming column D is payment date

    totalAmount += invoiceAmount;
    totalInvoiceCount++;

    // Vendor spend
    vendorSpend[vendor] = (vendorSpend[vendor] || 0) + invoiceAmount;

    // Category spend
    categorySpend[category] = (categorySpend[category] || 0) + invoiceAmount;

    // Monthly spend
    if (invoiceDateStr) {
      const invoiceDate = new Date(invoiceDateStr);
      const monthKey = invoiceDate.toLocaleString("default", { month: "short" });
      monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + invoiceAmount;

      // Quarterly spend
      const quarter = `Q${Math.floor(invoiceDate.getMonth() / 3) + 1} ${invoiceDate.getFullYear()}`;
      quarterlySpend[quarter] = (quarterlySpend[quarter] || 0) + invoiceAmount;
    }

    // Average payment time
    if (invoiceDateStr && paymentDateStr) {
      const invoiceDate = new Date(invoiceDateStr);
      const paymentDate = new Date(paymentDateStr);
      totalPaymentDays += (paymentDate - invoiceDate) / (1000 * 60 * 60 * 24); // days
    }
  });

  // Insights
  const highestSpendVendor = Object.entries(vendorSpend).reduce(
    (max, [vendor, amount]) => (amount > max.amount ? { vendor, amount } : max),
    { vendor: "", amount: 0 }
  );

  const averageInvoice = totalAmount / totalInvoiceCount;
  const avgPaymentTime = totalPaymentDays / totalInvoiceCount;

  // Cost reduction placeholder: you may calculate from historical data
  const costReduction = previousTotalAmount
    ? ((previousTotalAmount - totalAmount) / previousTotalAmount) * 100
    : 0;

  // Top vendors sorted
  const topVendors = Object.entries(vendorSpend)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // top 5 vendors

  // Spend by category sorted
  const spendByCategory = Object.entries(categorySpend)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Monthly trend sorted by calendar order
  const monthsOrder = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  const monthlyTrend = monthsOrder
    .filter((month) => monthlySpend[month])
    .map((month) => ({ name: month, value: monthlySpend[month] }));

  // Quarterly trend sorted
  const quarterlyTrend = Object.keys(quarterlySpend)
    .sort()
    .map((q) => ({ name: q, value: quarterlySpend[q] }));

  return {
    totalRecords,
    totalAmount,
    insights: {
      highestSpend: highestSpendVendor,
      averageInvoice: parseFloat(averageInvoice.toFixed(2)),
      costReduction: parseFloat(costReduction.toFixed(2)),
      avgPaymentTime: parseFloat(avgPaymentTime.toFixed(2)),
    },
    monthlyTrend,
    quarterlyTrend,
    topVendors,
    spendByCategory,
    expensesByVendor: vendorSpend,
  };
};
