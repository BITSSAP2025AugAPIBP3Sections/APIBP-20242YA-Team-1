import { appendInvoiceData, exportSheetData } from "../services/sheetsService.js";
import { fetchAnalyticsData } from "../services/analyticsService.js";

export const updateSheet = async (req, res) => {
  try {
    let payload;

    if (req.file) {
      const fileContent = req.file.buffer.toString("utf-8");
      payload = JSON.parse(fileContent);
      console.log("File uploaded and parsed");
    } 
    else if (req.body && Object.keys(req.body).length) {
      payload = req.body;
      console.log("JSON body received");
    } 
    else {
      return res.status(400).json({ success: false, message: "No file or JSON data provided" });
    }

    const result = await appendInvoiceData(payload);
    res.status(201).json({ success: true, message: "Data stored successfully", result });

  } catch (err) {
    console.error("Error in updateSheet:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
    const format = req.query.format || "csv";
    const filePath = await exportSheetData(format);

    return res.download(filePath, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        return res.status(500).json({ error: "Failed to download file" });
      }
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return res.status(500).json({ error: error.message });
  }
};