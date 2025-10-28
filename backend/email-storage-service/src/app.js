import express from "express";
import cors from "cors";
import  {config} from  "./config/index.js";

//imports for swagger documentation
import swaggerUi from "swagger-ui-express";
import {swaggerDocs} from "./routes/swaggerDocs.js";


const app = express();
app.use(cors());
app.use(express.json());

// Swagger Documentation Route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// Health check Route
app.get("/health", (req, res) => {
   res.json({status:"OK", service: "email-storage-service"});
}

);

//Default Route
app.get("/", (req, res) => {
    res.send("Welcome to the Email Storage Service API");
});

// Start the server

app.listen(config.port, () => {
    console.log(`Email Storage Service is running on port ${config.port}`);
    console.log(`Swagger docs available at http://localhost:${config.port}/api-docs`);
});