import express from "express";
import { updateSheet, getSummary, getTrends, exportData } from "../controllers/sheetsController.js";

const router = express.Router();

router.post("/update", updateSheet);
router.get("/summary", getSummary);
router.get("/trends", getTrends);
router.get("/export", exportData);

export default router;