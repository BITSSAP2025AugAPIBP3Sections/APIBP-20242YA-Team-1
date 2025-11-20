import AnalyticsSnapshot from "../models/AnalyticsSnapshot.js";

const ttlMinutes = parseInt(process.env.ANALYTICS_SNAPSHOT_TTL_MINUTES || "60", 10);

function isFresh(doc) {
  if (!doc) return false;
  const ageMs = Date.now() - new Date(doc.computedAt).getTime();
  return ageMs < ttlMinutes * 60 * 1000;
}

// GET /api/v1/analytics/snapshots?userId=...&period=...
export async function getAnalyticsSnapshot(req, res) {
  try {
    const { userId, period = "year" } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }
    const doc = await AnalyticsSnapshot.findOne({ userId, period }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Snapshot not found" });
    }
    const fresh = isFresh(doc);
    return res.json({
      success: true,
      cached: fresh,
      stale: !fresh,
      userId,
      period,
      computedAt: doc.computedAt,
      data: doc.data
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: `Error retrieving snapshot: ${e.message}` });
  }
}

// POST /api/v1/analytics/snapshots { userId, period, data }
export async function upsertAnalyticsSnapshot(req, res) {
  try {
    const { userId, period, data } = req.body;
    if (!userId || !period || !data) {
      return res.status(400).json({ success: false, message: "userId, period, data required" });
    }
    const update = {
      data,
      computedAt: new Date()
    };
    const doc = await AnalyticsSnapshot.findOneAndUpdate(
      { userId, period },
      { $set: update },
      { upsert: true, new: true }
    ).lean();
    return res.json({ success: true, cached: false, userId, period, computedAt: doc.computedAt });
  } catch (e) {
    return res.status(500).json({ success: false, message: `Error upserting snapshot: ${e.message}` });
  }
}

// (Optional) DELETE for invalidation - not yet wired
export async function deleteAnalyticsSnapshot(req, res) {
  try {
    const { userId, period } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }
    const filter = period ? { userId, period } : { userId };
    const result = await AnalyticsSnapshot.deleteMany(filter);
    return res.json({ success: true, deleted: result.deletedCount });
  } catch (e) {
    return res.status(500).json({ success: false, message: `Error deleting snapshot(s): ${e.message}` });
  }
}
