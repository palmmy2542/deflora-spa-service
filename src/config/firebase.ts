import admin from "firebase-admin";
import { config } from "./config";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: config.firebase.projectId,
    credential: admin.credential.cert(config.firebase.credential ?? ""),
  });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

export const authAdmin = admin.auth();
