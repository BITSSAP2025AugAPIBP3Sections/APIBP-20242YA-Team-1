import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import express from "express";

const router = express.Router();

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Google Sheets Analytics Service API",
      version: "1.0.0",
      description:
        "API documentation for Google Sheets Analytics Service – handles analytics data updates and communication with Google Sheets.",
    },
    servers: [
    {
      url: "http://localhost:4002",
      description: "Local development server",
    },
    {
      url: "https://deploy-email-service-1-1-1.onreder.com",
      description: "Production server",
    },
  ],
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"], // path to your API doc comments
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

router.use("/", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export const swaggerDocs = (app) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log("Swagger Docs available at http://localhost:4004/api-docs");
  };

export default router;