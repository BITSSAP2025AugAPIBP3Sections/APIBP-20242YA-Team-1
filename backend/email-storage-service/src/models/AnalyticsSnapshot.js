import mongoose from "mongoose";

const ttlMinutes = parseInt(process.env.ANALYTICS_SNAPSHOT_TTL_MINUTES || "60", 10);

const analyticsSnapshotSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  period: { type: String, required: true }, // month | quarter | year | all
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  computedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Unique compound index to prevent duplicates for same userId+period
analyticsSnapshotSchema.index({ userId: 1, period: 1 }, { unique: true });
// TTL index for automatic expiration (documents removed after ttlMinutes)
analyticsSnapshotSchema.index({ computedAt: 1 }, { expireAfterSeconds: ttlMinutes * 60 });

export default mongoose.model("AnalyticsSnapshot", analyticsSnapshotSchema);
