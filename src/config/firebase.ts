import admin from "firebase-admin";
import { config } from "./config.js";
import type { Auth } from "firebase-admin/auth";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: config.firebase.projectId ?? "",
  });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

export const authAdmin: Auth = admin.auth();
