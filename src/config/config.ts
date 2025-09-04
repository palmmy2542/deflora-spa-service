import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

export const config = {
  port: process.env.PORT || 3000,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
};
