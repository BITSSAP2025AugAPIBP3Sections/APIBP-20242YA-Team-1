import express from "express";
import { updateSheet, exportData, getAnalytics } from "../controllers/sheetsController.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   - name: Sheets
 *     description: Google Sheets Data Sync & Processing APIs
 *   - name: Analytics
 *     description: Finance Insights & Spend Analysis
 */

/**
 * @swagger
 * /api/v1/sheets/update:
 *   post:
 *     summary: Process invoice JSON or trigger Google Drive sync
 *     operationId: processInvoiceData
 *     tags: [Sheets]
 *     description: |
 *       This API is called automatically by the OCR extraction service after reading invoices.  
 *       It supports:
 *       - Sending single or multiple invoice JSON objects for updating Google Sheets.
 *       - Triggering Drive sync to process new vendor folders.
 *
 *       **Example call from OCR service**
 *       ```bash
 *       POST /api/v1/sheets/update
 *       Content-Type: application/json
 *
 *       {
 *         "invoices": [
 *           {
 *             "invoiceNumber": "INV-1234",
 *             "vendorName": "Amazon",
 *             "totalAmount": 1499.50,
 *             "invoiceDate": "2024-10-02"
 *           }
 *         ]
 *       }
 *       ```
 *
 *       **Drive sync trigger**
 *       ```bash
 *       POST /api/v1/sheets/update
 *       {
 *         "fromDrive": true
 *       }
 *       ```
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromDrive:
 *                 type: boolean
 *                 description: Trigger Google Drive folder scan and sheet update
 *               invoices:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Invoice JSON payload to append to sheet
 *             example:
 *               invoices:
 *                 - invoiceNumber: "INV-1234"
 *                   vendorName: "Amazon"
 *                   totalAmount: 1499.50
 *                   invoiceDate: "2024-10-02"
 *
 *     responses:
 *       200:
 *         description: Sheets updated successfully (Drive Sync or Invoice Append)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               message: Invoice JSON processed and appended to sheet
 *               result:
 *                 recordsAdded: 1
 *       400:
 *         description: Validation error or missing request body
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /api/v1/sheets/analytics:
 *   get:
 *     summary: Retrieve spending analytics & business insights
 *     operationId: getAnalyticsInsights
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Analytics data fetched successfully
 */

/**
 * @swagger
 * /api/v1/sheets/export:
 *   get:
 *     summary: Export sheet analytics in CSV/XLSX/JSON format
 *     operationId: exportAnalyticsFile
 *     tags: [Sheets]
 *     parameters:
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
 *     responses:
 *       200:
 *         description: File exported successfully
 */


router.post("/update", upload.single("file"), updateSheet);
router.get("/analytics", getAnalytics);
router.get("/export", exportData);

export default router;
