import express from "express";
import { updateSheet, getSummary, getTrends, exportData } from "../controllers/sheetsController.js";

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
 *     description: Accepts vendor name and amount, and stores it in Google Sheets.
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
 * /api/v1/sheets/summary:
 *   get:
 *     summary: Get total expenses summary
 *     description: Returns overall data summary like total amount, number of transactions, etc.
 *     tags: [Sheets]
 *     responses:
 *       200:
 *         description: Summary fetched successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sheets/trends:
 *   get:
 *     summary: Get spending trends over time
 *     description: Returns trends data such as monthly/weekly vendor-wise expenses.
 *     tags: [Sheets]
 *     responses:
 *       200:
 *         description: Trends fetched successfully
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

router.post("/update", updateSheet);
router.get("/summary", getSummary);
router.get("/trends", getTrends);
router.get("/export", exportData);

export default router;