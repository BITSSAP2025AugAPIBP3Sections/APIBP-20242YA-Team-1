import { appendInvoiceData, fetchSummary, fetchTrends, exportSheetData } from "../services/sheetsService.js";

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