import mongoose from "mongoose";
import logger from "../utils/logger.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB Connected Successfully");
  } catch (error) {
    logger.error(error, { msg: "MongoDB Connection Error" });
    process.exit(1);
  }
};
