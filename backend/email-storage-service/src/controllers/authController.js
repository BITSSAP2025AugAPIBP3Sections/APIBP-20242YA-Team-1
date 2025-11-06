import { google } from "googleapis";
import User from "../models/User.js";
import { config } from "../config/index.js";

const oauth2Client = new google.auth.OAuth2(
  config.google.clientId || process.env.GOOGLE_CLIENT_ID,
  config.google.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
  config.google.redirectUri || process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

// Step 1: Send Google OAuth URL
export const getGoogleAuthURL = (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  res.json({ url });
};

// Step 2: Callback - Google returns code
export const googleOAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);

    // Set credentials to call userinfo
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userinfo } = await oauth2.userinfo.get();

    const email = userinfo?.email;
    if (!email) {
      return res.status(400).json({ message: "Unable to retrieve user email from Google" });
    }

    // Fetch existing user to preserve refresh token if Google didn't return one
    const existing = await User.findOne({ email });

    await User.findOneAndUpdate(
      { email },
      {
        googleAccessToken: tokens.access_token || existing?.googleAccessToken,
        googleRefreshToken: tokens.refresh_token || existing?.googleRefreshToken,
      },
      { upsert: true, new: true }
    );

    res.json({
      message: "Google account connected successfully!",
      email,
    });
  } catch (error) {
    res.status(500).json({ message: "OAuth Failed", error: error.message });
  }
};
