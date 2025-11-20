import express from "express";
import { getAnalyticsSnapshot, upsertAnalyticsSnapshot, deleteAnalyticsSnapshot } from "../controllers/analyticsController.js";

const router = express.Router();

/**
 * @route GET /api/v1/analytics/snapshots
 * @desc Retrieve analytics snapshot (freshness determined by TTL)
 */
router.get("/analytics/snapshots", getAnalyticsSnapshot);

/**
 * @route POST /api/v1/analytics/snapshots
 * @desc Upsert analytics snapshot after computation
 */
router.post("/analytics/snapshots", upsertAnalyticsSnapshot);

/**
 * @route DELETE /api/v1/analytics/snapshots
 * @desc Delete snapshots for user (optionally period)
 */
router.delete("/analytics/snapshots", deleteAnalyticsSnapshot);

export default router;
