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

router.post("/update", updateSheet);
router.get("/summary", getSummary);
router.get("/trends", getTrends);
router.get("/export", exportData);

export default router;