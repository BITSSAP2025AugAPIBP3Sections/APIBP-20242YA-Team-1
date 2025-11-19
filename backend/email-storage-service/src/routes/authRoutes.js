import express from "express";
import { getGoogleAuthURL, googleOAuthCallback } from "../controllers/authController.js";

const router = express.Router();

router.get("/auth/google", getGoogleAuthURL);
router.get("/auth/google/callback", googleOAuthCallback);

export default router;
