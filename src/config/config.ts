import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file
export const config = {
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  port: process.env.PORT ?? 8080,
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
};
