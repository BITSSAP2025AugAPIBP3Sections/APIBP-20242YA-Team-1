import { appendInvoiceData, fetchSummary, fetchTrends, exportSheetData } from "../services/sheetsService.js";

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

export const getSummary = async (req, res) => {
  try {
    const data = await fetchSummary();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTrends = async (req, res) => {
    try {
      const data = await fetchTrends();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
  try {
    const data = await fetchTrends();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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