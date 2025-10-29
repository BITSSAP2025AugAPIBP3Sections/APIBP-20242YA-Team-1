import express from "express";
import dotenv from "dotenv";
import sheetsRoutes from "./src/routes/sheetsRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use("/api/v1/sheets", sheetsRoutes);

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`Google Sheets & Analytics Service running on port ${PORT}`);
});