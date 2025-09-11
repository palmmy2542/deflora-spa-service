import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file
export const config = {
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  port: process.env.PORT ?? 8080,
  backofficeURL: process.env.BACKOFFICE_URL,
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
  collection: {
    bookings: process.env.BOOKINGS_COLLECTION ?? "bookings",
    programs: process.env.PROGRAMS_COLLECTION ?? "programs",
    packages: process.env.PACKAGES_COLLECTION ?? "packages",
  },

  googleCalendar: {
    calendarId: process.env.CALENDAR_ID,
    calendarEventId: process.env.CALENDAR_EVENT_ID,
  },

  googleService: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY,
  },
};
