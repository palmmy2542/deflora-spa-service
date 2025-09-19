import { Router } from "express";
import { db, FieldValue } from "../config/firebase.js";
import { authenticate } from "../middleware/auth.js";
import { ProgramSchema } from "../validators/schemas.js";
import { config } from "../config/config.js";

const router = Router();
const col = db.collection(config.collection.programs);

router.post("/", authenticate, async (req, res, next) => {
  try {
    const parsed = ProgramSchema.parse(req.body);
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

router.get("/", authenticate, async (req, res, next) => {
  try {
    const snap = await col.orderBy("updatedAt", "desc").get();
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt.toDate(),
      updatedAt: d.data().updatedAt.toDate(),
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/active", async (req, res, next) => {
  try {
    const snap = await col
      .where("isActive", "==", true)
      .orderBy("updatedAt", "desc")
      .get();
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt.toDate(),
      updatedAt: d.data().updatedAt.toDate(),
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.params.id)
      return res.status(404).json({ error: "Program not found" });

    const d = await col.doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Program not found" });
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

router.patch("/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.params.id)
      return res.status(404).json({ error: "Program not found" });

    const parsed = ProgramSchema.partial().parse(req.body);

    await col
      .doc(req.params.id)
      .update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    const d = await col.doc(req.params.id).get();
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

// Soft-delete: isActive = false
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.params.id)
      return res.status(404).json({ error: "Program not found" });

    await col
      .doc(req.params.id)
      .update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
