import express from "express";
import dotenv from "dotenv";
dotenv.config();

// Routes & Swagger
import sheetsRoutes from "./src/routes/sheetsRoutes.js";
import { swaggerDocs } from "./src/routes/swaggerDocs.js";

const app = express();
app.use(express.json());

// Routes
app.use("/api/v1/sheets", sheetsRoutes);

// Swagger Documentation
swaggerDocs(app);

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`Google Sheets & Analytics Service running on port ${PORT}`);
  console.log(`Swagger Docs → http://localhost:${PORT}/api-docs`);
});
