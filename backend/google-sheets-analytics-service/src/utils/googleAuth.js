import { google } from "googleapis";

export const getSheetsClient = async () => {
  // Check for Google authentication credentials
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Google Sheets client requires authentication credentials. Please set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of your service account key file."
    );
  }
  // Future: handle OAuth or Service Account auth
  return google.sheets({ version: "v4" });
};
