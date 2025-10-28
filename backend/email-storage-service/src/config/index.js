import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port : process.env.PORT || 4002,
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        redirectUri: process.env.DRIVE_FOLDER_ID,
    }

};