import express from "express";
import { updateSheet, exportData, getAnalytics } from "../controllers/sheetsController.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Sheets
 *   description: Google Sheets Analytics Service APIs
 */

/**
 * @swagger
 * /api/v1/sheets/update:
 *   post:
 *     summary: Upload invoice data or sync data from Google Drive
 *     description: |
 *       - Upload invoice JSON using file upload or JSON body  
 *       - Or send `{ "fromDrive": true }` to sync all vendor folders from Google Drive  
 *     tags: [Sheets]
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Upload a JSON file containing invoices
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               fromDrive: true
 *     responses:
 *       200:
 *         description: Drive Sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *       201:
 *         description: Invoice JSON appended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *       400:
 *         description: Bad request — missing file or data
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /api/v1/sheets/analytics:
 *   get:
 *     summary: Get analytics data from Google Sheets
 *     description: Fetches total spend, insights, trends, vendor analytics, and category-wise breakdown directly from Google Sheets.
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Analytics retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRecords:
 *                       type: integer
 *                       example: 42
 *                     totalAmount:
 *                       type: number
 *                       example: 5861.73
 *                     insights:
 *                       type: object
 *                       properties:
 *                         highestSpend:
 *                           type: object
 *                           properties:
 *                             vendor:
 *                               type: string
 *                               example: Amazon
 *                             amount:
 *                               type: number
 *                               example: 5000
 *                         averageInvoice:
 *                           type: number
 *                           example: 732.72
 *                         costReduction:
 *                           type: number
 *                           example: 0
 *                         avgPaymentTime:
 *                           type: number
 *                           example: 12.4
 *                     monthlyTrend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Jan
 *                           value:
 *                             type: number
 *                             example: 1500
 *                     quarterlyTrend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Q1 2024
 *                           value:
 *                             type: number
 *                             example: 4500
 *                     topVendors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Amazon
 *                           value:
 *                             type: number
 *                             example: 5000
 *                     spendByCategory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Office Supplies
 *                           value:
 *                             type: number
 *                             example: 1200
 *                     expensesByVendor:
 *                       type: object
 *                       example:
 *                         Amazon: 5000
 *                         Flipkart: 861.73
 */

/**
 * @swagger
 * /api/v1/sheets/export:
 *   get:
 *     summary: Export sheet data in CSV, XLSX, or JSON format
 *     description: Returns a downloadable exported file of analytics
 *     tags: [Sheets]
 *     parameters:
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
 *         description: Format of exported file
 *     responses:
 *       200:
 *         description: File exported successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Failed to export file
 */

router.post("/update", upload.single("file"), updateSheet);
router.get("/analytics", async (req, res) => {
    const data = await fetchAnalyticsData();
    res.json({
      success: true,
      message: "Analytics retrieved successfully",
      data,
    });
  });
router.get("/export", exportData);

export default router;
