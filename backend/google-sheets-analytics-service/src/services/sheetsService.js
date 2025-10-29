export const appendInvoiceData = async (invoice) => {
    // TODO: Connect to Google Sheets and append data
    console.log("Appending invoice:", invoice);
    return { success: true };
  };
  
  export const fetchSummary = async () => {
    // TODO: Calculate total per vendor
    return [{ vendor: "Amazon", total: 45000 }];
  };
  
  export const fetchTrends = async () => {
    // TODO: Return monthly spending trend
    return { "2025-01": 10000, "2025-02": 15000 };
  };
  
  export const exportSheetData = async (format) => {
    // TODO: Export CSV or Excel
    return "./dummy.csv";
  };
  