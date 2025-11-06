import express from "express";
import { fetchEmailsController } from "../controllers/emailController.js";

const router = express.Router();

// POST /api/v1/email/fetch
router.post("/email/fetch", fetchEmailsController);

export default router;
