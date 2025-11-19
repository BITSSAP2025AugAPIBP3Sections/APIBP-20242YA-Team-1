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
  // Redirect to Google OAuth instead of returning JSON
  res.redirect(url);
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
      return res.status(400).json({ 
        message: "Unable to retrieve email from Google account.",
        details: "Google OAuth succeeded but no email address was returned. This may indicate missing OAuth scopes.",
        action: "Try authenticating again at /auth/google with proper email scope permissions."
      });
    }

    // Fetch existing user to preserve refresh token if Google didn't return one
    const existing = await User.findOne({ email });

    const user = await User.findOneAndUpdate(
      { email },
      {
        googleAccessToken: tokens.access_token || existing?.googleAccessToken,
        googleRefreshToken: tokens.refresh_token || existing?.googleRefreshToken,
      },
      { upsert: true, new: true }
    );

    // Redirect to frontend email sync page with success message
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8000";
    res.redirect(`${frontendUrl}/email-sync?connected=true&email=${encodeURIComponent(email)}&userId=${encodeURIComponent(user._id)}`);
  } catch (error) {
    let userMessage = "Google OAuth authentication failed.";
    let suggestions = [];

    if (error.message?.includes("invalid_grant")) {
      userMessage = "Invalid or expired authorization code.";
      suggestions = ["The authorization code has already been used or expired", "Start the OAuth flow again at /auth/google"];
    } else if (error.message?.includes("redirect_uri_mismatch")) {
      userMessage = "OAuth redirect URI mismatch.";
      suggestions = ["Contact administrator to verify Google OAuth configuration", "Check that redirect URI matches Google Console settings"];
    } else if (!req.query.code) {
      userMessage = "Missing authorization code.";
      suggestions = ["This endpoint should be called by Google after user consent", "Do not call this endpoint directly"];
    }

    res.status(500).json({ 
      message: userMessage,
      details: error.message,
      suggestions: suggestions.length > 0 ? suggestions : ["Try authenticating again at /auth/google", "Check server logs for more details"],
      timestamp: new Date().toISOString()
    });
  }
};
