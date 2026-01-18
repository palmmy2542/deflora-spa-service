import { Router } from "express";
import { db, FieldValue } from "../config/firebase.js";
import { authenticate } from "../middleware/auth.js";
import { PackageSchema } from "../validators/schemas.js";
import { config } from "../config/config.js";

const packageRouter = Router();
const col = db.collection(config.collection.packages);

packageRouter.post("/", authenticate, async (req, res, next) => {
  try {
    const parsed = PackageSchema.parse(req.body);
    const doc = await col.add({
      ...parsed,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const snap = await doc.get();
    res.status(201).json({ id: doc.id, ...snap.data() });
  } catch (e) {
    next(e);
  }
});

packageRouter.get("/", authenticate, async (_req, res, next) => {
  try {
    const snap = await col.orderBy("updatedAt", "desc").get();
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data()?.createdAt?.toDate(),
      updatedAt: d.data()?.updatedAt?.toDate(),
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

packageRouter.get("/active", async (_req, res, next) => {
  try {
    const snap = await col
      .where("isActive", "==", true)
      .orderBy("updatedAt", "desc")
      .get();
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data()?.createdAt?.toDate(),
      updatedAt: d.data()?.updatedAt?.toDate(),
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

packageRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.params.id)
      return res.status(404).json({ error: "Package not found" });
    const d = await col.doc(req.params.id as string).get();
    if (!d.exists) return res.status(404).json({ error: "Package not found" });
    res.json({
      id: d.id,
      ...d.data(),
      createdAt: d.data()?.createdAt?.toDate(),
      updatedAt: d.data()?.updatedAt?.toDate(),
    });
  } catch (e) {
    next(e);
  }
});

packageRouter.patch("/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.params.id)
      return res.status(404).json({ error: "Package not found" });
    // Partial validation: use .partial()
    const parsed = PackageSchema.partial().parse(req.body);
    await col
      .doc(req.params.id as string)
      .update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    const d = await col.doc(req.params.id as string).get();
    res.json({
      id: d.id,
      ...d.data(),
      createdAt: d.data()?.createdAt?.toDate(),
      updatedAt: d.data()?.updatedAt?.toDate(),
    });
  } catch (e) {
    next(e);
  }
});

// Soft delete
packageRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.params.id)
      return res.status(404).json({ error: "Package not found" });
    await col
      .doc(req.params.id as string)
      .update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default packageRouter;
