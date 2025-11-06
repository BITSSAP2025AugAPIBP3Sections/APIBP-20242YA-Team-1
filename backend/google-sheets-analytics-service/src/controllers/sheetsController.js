import { appendInvoiceData, fetchSummary, fetchTrends, exportSheetData } from "../services/sheetsService.js";

export const updateSheet = async (req, res) => {
  try {
    const { vendor, amount, date } = req.body;

    if (!vendor || !amount) {
      return res.status(400).json({ message: "Vendor and amount are required" });
    }

    const expenseDate = date || new Date().toISOString().split("T")[0];

    const response = await appendInvoiceData({
      vendor,
      amount,
      date: expenseDate,
    });

    res.status(201).json(response);
  } catch (error) {
    console.error("Error updating sheet:", error);
    res.status(500).json({ message: "Failed to update the Google Sheet" });
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
    const file = await exportSheetData(req.query.format);
    res.download(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};