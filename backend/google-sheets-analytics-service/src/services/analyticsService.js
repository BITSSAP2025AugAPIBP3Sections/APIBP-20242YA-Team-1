import { sheets } from "./sheetsService.js";
import dotenv from "dotenv";
dotenv.config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Expenses";

export const fetchAnalyticsData = async () => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`, // Adjust if more columns exist
  });

  const rows = response.data.values || [];
  if (rows.length < 2) {
    return { message: "No data available in sheet" };
  }

  const dataRows = rows.slice(1);

  let totalAmount = 0;
  let totalInvoiceCount = 0;
  const vendorSpend = {};
  const categorySpend = {};
  const monthlySpend = {};
  const quarterlySpend = {};

  let totalPaymentDays = 0;
  let paidInvoiceCount = 0;
  let previousTotalAmount = 0; // for cost reduction if historical data exists

  dataRows.forEach((row) => {
    const vendor = row[0] || "Unknown Vendor";
    const category = row[1] || "Uncategorized";
    const invoiceDateStr = row[2];
    const paymentDateStr = row[3];
    const invoiceAmount = parseFloat(row[7]) || 0;

    totalAmount += invoiceAmount;
    totalInvoiceCount++;

    // Vendor spend
    vendorSpend[vendor] = (vendorSpend[vendor] || 0) + invoiceAmount;

    // Category spend
    categorySpend[category] = (categorySpend[category] || 0) + invoiceAmount;

    // Monthly spend
    if (invoiceDateStr) {
      const invoiceDate = new Date(invoiceDateStr);
      if (!isNaN(invoiceDate.getTime())) {
        const monthKey = invoiceDate.toLocaleString("default", { month: "short" });
        monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + invoiceAmount;

        // Quarterly spend
        const quarterKey = `Q${Math.floor(invoiceDate.getMonth() / 3) + 1} ${invoiceDate.getFullYear()}`;
        quarterlySpend[quarterKey] = (quarterlySpend[quarterKey] || 0) + invoiceAmount;
      }
    }

    // Average payment time
    if (invoiceDateStr && paymentDateStr) {
      const invoiceDate = new Date(invoiceDateStr);
      const paymentDate = new Date(paymentDateStr);
      if (!isNaN(invoiceDate.getTime()) && !isNaN(paymentDate.getTime())) {
        totalPaymentDays += (paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24); // days
        paidInvoiceCount++;
      }
    }
  });

  // Insights
  const highestSpendVendor = Object.entries(vendorSpend).reduce(
    (max, [vendor, amount]) => (amount > max.amount ? { vendor, amount } : max),
    { vendor: "", amount: 0 }
  );

  const averageInvoice = totalAmount / totalInvoiceCount;
  const avgPaymentTime = paidInvoiceCount ? totalPaymentDays / paidInvoiceCount : 0;

  const costReduction = previousTotalAmount
    ? ((previousTotalAmount - totalAmount) / previousTotalAmount) * 100
    : 0;

  // Top vendors (top 5)
  const topVendors = Object.entries(vendorSpend)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Spend by category
  const spendByCategory = Object.entries(categorySpend)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Monthly trend (calendar order)
  const monthsOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyTrend = monthsOrder
    .filter((month) => monthlySpend[month])
    .map((month) => ({ name: month, value: monthlySpend[month] }));

  // Quarterly trend sorted by year and quarter number
  const quarterlyTrend = Object.entries(quarterlySpend)
    .map(([name, value]) => {
      const [q, year] = name.split(" ");
      const qNum = parseInt(q.replace("Q", ""));
      return { name, value, year: parseInt(year), qNum };
    })
    .sort((a, b) => a.year - b.year || a.qNum - b.qNum)
    .map(({ name, value }) => ({ name, value }));

  return {
    totalRecords: totalInvoiceCount,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
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