import express from "express";
import dotenv from "dotenv";

//All your source code is inside src/
import sheetsRoutes from "./src/routes/sheetsRoutes.js";
import { swaggerDocs } from "./src/routes/swaggerDocs.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/v1/sheets", sheetsRoutes);

swaggerDocs(app);  // This mounts /api-docs automatically

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`Google Sheets & Analytics Service running on port ${PORT}`);
  console.log(`Swagger Docs → http://localhost:${PORT}/api-docs`);
});
