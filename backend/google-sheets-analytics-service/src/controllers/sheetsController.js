import { appendInvoiceData, exportSheetData } from "../services/sheetsService.js";
import { fetchAnalyticsData } from "../services/analyticsService.js";

export const updateSheet = async (req, res) => {
  try {
    const result = await appendInvoiceData(req.body);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.status(201).json({ message: "Data stored successfully", result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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
    console.error("Error in getAnalytics:", error);
    res.status(500).json({
      success: false,
      message: "Error while retrieving analytics",
      error: error.message,
    });
  }
};

export const exportData = async (req, res) => {
  try {
    const file = await exportSheetData(req.query.format);
    res.download(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};