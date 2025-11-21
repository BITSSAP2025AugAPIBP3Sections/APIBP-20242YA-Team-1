import mongoose from "mongoose";

// Tracks which Gmail message attachments have already been uploaded to Drive
// so subsequent (force) syncs never re-upload the same binary again.
// Uniqueness anchored on (userId + gmailMessageId + gmailAttachmentId).

const ProcessedAttachmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gmailMessageId: { type: String, required: true },
    gmailAttachmentId: { type: String, required: true },
    vendor: { type: String, required: true },
    fileName: { type: String, required: true },
    driveFileId: { type: String, required: true },
    vendorFolderId: { type: String },
    invoiceFolderId: { type: String },
    webViewLink: { type: String },
    webContentLink: { type: String },
    sha256: { type: String }, // optional content hash for future integrity checks
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

ProcessedAttachmentSchema.index(
  { userId: 1, gmailMessageId: 1, gmailAttachmentId: 1 },
  { unique: true }
);

export default mongoose.model("ProcessedAttachment", ProcessedAttachmentSchema);