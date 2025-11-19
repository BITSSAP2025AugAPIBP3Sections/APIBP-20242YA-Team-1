import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    lastSyncedAt: { type: Date, default: null },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // optional for now if using Google only

    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
