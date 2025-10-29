import { google } from "googleapis";

export const getSheetsClient = async () => {
  // Future: handle OAuth or Service Account auth
  return google.sheets({ version: "v4" });
};
