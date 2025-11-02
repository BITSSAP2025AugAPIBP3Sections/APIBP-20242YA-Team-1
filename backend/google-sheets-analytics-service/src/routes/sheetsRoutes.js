import express from "express";
import { updateSheet, getSummary, getTrends, exportData } from "../controllers/sheetsController.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/sheets/update:
 *   post:
 *     summary: Update Google Sheets data
 *     description: Receives vendor and amount, updates Google Sheets with the transaction info.
 *     tags:
 *       - Sheets
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
 *         description: Successfully processed and sent data to Google Sheets
 *       400:
 *         description: Invalid request data
 */

router.post("/update", updateSheet);
router.get("/summary", getSummary);
router.get("/trends", getTrends);
router.get("/export", exportData);

export default router;