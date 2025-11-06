import express from "express";
import { updateSheet, exportData, getAnalytics } from "../controllers/sheetsController.js";
import multer from "multer";

const router = express.Router();

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
 *     summary: Add a new transaction to Google Sheets
 *     description: Accepts vendor name and amount and stores it in Google Sheets.
 *     tags: [Sheets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendor:
 *                 type: string
 *                 example: "Amazon"
 *               amount:
 *                 type: number
 *                 example: 1200
 *     responses:
 *       200:
 *         description: Successfully updated the sheet
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sheets/analytics:
 *   get:
 *     summary: Get analytics data from Google Sheet
 *     description: Returns analytics such as total rows, total amount, category-wise spending, etc.
 *     tags: [Sheets]
 *     responses:
 *       200:
 *         description: Analytics data fetched successfully
 *       404:
 *         description: No analytics data found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sheets/export:
 *   get:
 *     summary: Export analytics data
 *     description: Exports data to CSV or downloadable format from Google Sheets.
 *     tags: [Sheets]
 *     responses:
 *       200:
 *         description: File exported successfully
 *       500:
 *         description: Failed to export data
 */

const upload = multer({ storage: multer.memoryStorage() });

router.post("/update", upload.single("file"), updateSheet);
router.get("/analytics", getAnalytics);
router.get("/export", exportData);

export default router;
