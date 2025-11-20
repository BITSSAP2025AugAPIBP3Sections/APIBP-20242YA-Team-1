import User from "../models/User.js";
import logger from "../utils/logger.js";

export const getUserSyncStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid userId format.",
        details: "userId must be a valid 24-character MongoDB ObjectId.",
        providedValue: userId
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found.",
        details: "No user exists with the provided userId.",
        action: "Verify the userId or complete OAuth authentication at /auth/google.",
        userId: userId
      });
    }

    const hasConnection = !!(user.googleRefreshToken);
    const lastSync = user.lastSyncedAt;

    let message = "User has never synced emails.";
    if (lastSync) {
      message = `User last synced on ${lastSync.toISOString()}. Next fetch will only get emails after this date unless forceSync=true is set.`;
    }

    return res.status(200).json({
      userId,
      email: user.email,
      lastSyncedAt: lastSync,
      hasGoogleConnection: hasConnection,
      message,
    });
  } catch (error) {
    logger.error(error, { context: "getUserSyncStatus" });
    return res.status(500).json({
      message: "Failed to retrieve user sync status.",
      details: error.message,
      suggestions: ["Check if the database connection is working", "Verify the userId is correct"],
      timestamp: new Date().toISOString()
    });
  }
};

export const resetUserSyncStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid userId format.",
        details: "userId must be a valid 24-character MongoDB ObjectId.",
        providedValue: userId
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found.",
        details: "No user exists with the provided userId.",
        userId: userId
      });
    }

    await User.findByIdAndUpdate(userId, {
      lastSyncedAt: null,
    });

    logger.info("User sync status reset", { userId, email: user.email });

    return res.status(200).json({
      message: "Sync status reset successfully. Next fetch will use the fromDate parameter.",
      userId,
    });
  } catch (error) {
    logger.error(error, { context: "resetUserSyncStatus" });
    return res.status(500).json({
      message: "Failed to reset sync status.",
      details: error.message,
      suggestions: ["Check database connection", "Verify the userId exists", "Try again in a few moments"],
      timestamp: new Date().toISOString()
    });
  }
};

export const disconnectGoogleAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid userId format.",
        details: "userId must be a valid 24-character MongoDB ObjectId.",
        providedValue: userId
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        details: "No user exists with the provided userId.",
        userId
      });
    }
    // Null out Google tokens
    await User.findByIdAndUpdate(userId, {
      googleAccessToken: null,
      googleRefreshToken: null,
    });
    logger.info("Google account disconnected", { userId, email: user.email });
    return res.status(200).json({
      message: "Google Drive connection disconnected successfully.",
      userId,
      hasGoogleConnection: false
    });
  } catch (error) {
    logger.error(error, { context: "disconnectGoogleAccount" });
    return res.status(500).json({
      message: "Failed to disconnect Google account.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
