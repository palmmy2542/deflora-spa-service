import { Router } from "express";
import { db, FieldValue } from "../config/firebase.js";
import { PackageSchema } from "../validators/schemas.js";
import { requireRole } from "../middleware/auth.js";

const packageRouter = Router();
const col = db.collection("packages");

packageRouter.post(
  "/",
  requireRole(["admin", "staff"]),
  async (req, res, next) => {
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
  }
);

packageRouter.get("/", async (_req, res, next) => {
  try {
    const snap = await col.orderBy("name").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

packageRouter.get("/active", async (_req, res, next) => {
  try {
    const snap = await col.where("isActive", "==", true).orderBy("name").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

packageRouter.get("/:id", async (req, res, next) => {
  try {
    const d = await col.doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Package not found" });
    res.json({ id: d.id, ...d.data() });
  } catch (e) {
    next(e);
  }
});

packageRouter.patch(
  "/:id",
  requireRole(["admin", "staff"]),
  async (req, res, next) => {
    try {
      // Partial validation: use .partial()
      const parsed = PackageSchema.partial().parse(req.body);
      await col
        .doc(req.params.id)
        .update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
      const d = await col.doc(req.params.id).get();
      res.json({ id: d.id, ...d.data() });
    } catch (e) {
      next(e);
    }
  }
);

// Soft delete
packageRouter.delete("/:id", requireRole(["admin"]), async (req, res, next) => {
  try {
    await col
      .doc(req.params.id)
      .update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default packageRouter;
