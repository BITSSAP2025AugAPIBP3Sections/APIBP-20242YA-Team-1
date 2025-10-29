import { appendInvoiceData, fetchSummary, fetchTrends, exportSheetData } from "../services/sheetsService.js";

export const updateSheet = async (req, res) => {
  try {
    const result = await appendInvoiceData(req.body);
    res.json({ message: "Data added successfully", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
};

export const exportData = async (req, res) => {
  try {
    const file = await exportSheetData(req.query.format);
    res.download(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
