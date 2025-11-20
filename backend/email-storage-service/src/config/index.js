import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port : process.env.PORT || 4002,
    analytics: {
        snapshotTtlMinutes: parseInt(process.env.ANALYTICS_SNAPSHOT_TTL_MINUTES || '60', 10)
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4002/api/v1/auth/google/callback',
    }

};