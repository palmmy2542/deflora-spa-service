// lib/googleCalendar.ts
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const jwt = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL!,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: SCOPES,
});

export const calendar = google.calendar({ version: "v3", auth: jwt });
