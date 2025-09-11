// lib/googleCalendar.ts
import { google } from "googleapis";
import { config } from "../config/config.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const jwt = new google.auth.JWT({
  email: config.googleService.clientEmail!,
  key: (config.googleService.privateKey || "").replace(/\\n/g, "\n"),
  scopes: SCOPES,
});

if (!config.googleService.clientEmail || !config.googleService.privateKey) {
  console.warn(
    "WARNING: Missing environment variables GOOGLE_CLIENT_EMAIL and/or GOOGLE_PRIVATE_KEY. " +
      "Using Google Calendar API requires a valid Google Cloud API key."
  );
}

export const calendar = google.calendar({ version: "v3", auth: jwt });
