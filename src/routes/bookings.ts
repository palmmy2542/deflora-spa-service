import { Router } from "express";
import { db, FieldValue, Timestamp } from "../config/firebase.js";
import { requireRole } from "../middleware/auth.js";
import { generateEmail, sendEmail } from "../services/emailService.js";
import {
  computeTotals,
  snapshotPackages,
  snapshotPrograms,
} from "../utils/calc.js";
import {
  BookingCreateSchema,
  BookingUpdateDetailsSchema,
} from "../validators/schemas.js";

const router = Router();
const col = db.collection("bookings");

// status: pending | confirmed | canceled
function assertTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    pending: ["confirmed", "canceled", "pending"],
    confirmed: ["canceled", "confirmed"],
    canceled: ["canceled"],
  };
  if (!(allowed[from] || []).includes(to)) {
    const err: any = new Error(`Invalid status transition ${from} -> ${to}`);
    err.statusCode = 400;
    throw err;
  }
}

router.post(
  "/",
  requireRole(["admin", "staff", "viewer"]),
  async (req: any, res, next) => {
    try {
      const body = BookingCreateSchema.parse(req.body);

      const allProgramIds = new Set<string>();
      for (const it of body.items)
        for (const p of it.programs) allProgramIds.add(p.programId);
      const snapshotProgramsMap = await snapshotPrograms([...allProgramIds]);

      const allPackageIds = new Set<string>();
      for (const it of body.items)
        for (const p of it.packages) allPackageIds.add(p.packageId);
      const snapshotPackagesMap = await snapshotPackages([...allPackageIds]);

      const snapshotItems = body.items.map((it) => ({
        personName: it.personName,
        programs: it.programs.map((p) => {
          const s = snapshotProgramsMap.get(p.programId);
          if (!s) {
            const e: any = new Error(`Program not found: ${p.programId}`);
            e.statusCode = 400;
            throw e;
          }
          return {
            programId: p.programId,
            qty: p.qty,
            priceSnapshot: s.price,
            nameSnapshot: s.name,
            durationSnapshot: s.durationMinutes,
            currencySnapshot: s.currency,
          };
        }),
        packages: it.packages.map((p) => {
          const s = snapshotPackagesMap.get(p.packageId);
          if (!s) {
            const e: any = new Error(`Package not found: ${p.packageId}`);
            e.statusCode = 400;
            throw e;
          }
          return {
            packageId: p.packageId,
            priceSnapshot: s.packagePrice,
            nameSnapshot: s.name,
            originalPriceSnapshot: s.originalPrice,
            numberOfPeopleSnapshot: s.numberOfPeople,
            durationSnapshot: s.durationMinutes,
            currencySnapshot: s.currency,
          };
        }),
      }));

      const totals = computeTotals(snapshotItems);
      const doc = await col.add({
        status: "pending",
        arrivalAt: Timestamp.fromDate(new Date(body.arrivalAt)),
        contact: body.contact,
        items: snapshotItems,
        note: body.note ?? "",
        partySize: body.items.length,
        totals,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: req.user?.uid ?? null,
      });

      const snap = await doc.get();
      res.status(201).json({ id: doc.id, ...snap.data() });
      const compileTemplate = await generateEmail("booking-pending.hbs", {
        name: body.contact.name,
        companyName: "Deflora spa",
        date: new Date(body.arrivalAt).toLocaleDateString(),
        guests: body.items.map((it) => ({
          name: it.personName,
          programs: it.programs.map((p) => p.nameSnapshot),
        })),
        year: new Date().getFullYear(),
      });
      await sendEmail(
        body.contact.email,
        "Spa appointment pending",
        compileTemplate
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get("/", requireRole(["admin", "staff"]), async (req, res, next) => {
  try {
    const { status, from, to } = req.query as any;
    let q: FirebaseFirestore.Query = col.orderBy("createdAt", "desc");
    if (status) q = q.where("status", "==", String(status));
    if (from)
      q = q.where(
        "createdAt",
        ">=",
        Timestamp.fromDate(new Date(String(from)))
      );
    if (to)
      q = q.where("createdAt", "<=", Timestamp.fromDate(new Date(String(to))));
    const snap = await q.limit(200).get();
    res.json(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        arrivalAt: d.data().arrivalAt.toDate().toISOString(),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireRole(["admin", "staff"]), async (req, res, next) => {
  try {
    const d = await col.doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Booking not found" });
    res.json({
      id: d.id,
      ...d.data(),
      arrivalAt: d.data()?.arrivalAt?.toDate().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/:id",
  requireRole(["admin", "staff"]),
  async (req: any, res, next) => {
    try {
      const updates = BookingUpdateDetailsSchema.parse(req.body);
      const ref = col.doc(req.params.id);

      await db.runTransaction(async (trx) => {
        const snap = await trx.get(ref);
        if (!snap.exists) throw new Error("Booking not found");
        const data = snap.data() as any;
        if (data.status === "canceled") {
          const err: any = new Error(
            "Cannot update details of canceled booking"
          );
          err.statusCode = 400;
          throw err;
        }

        let items = data.items;
        let arrivalAt = data.arrivalAt;
        console.debug("Updates:", updates);

        if (updates.items) {
          const allProgramIds = new Set<string>();
          for (const it of updates.items)
            for (const p of it.programs) allProgramIds.add(p.programId);
          const snapshotProgramsMap = await snapshotPrograms([
            ...allProgramIds,
          ]);

          const allPackageIds = new Set<string>();
          for (const it of updates.items)
            for (const p of it.packages) allPackageIds.add(p.packageId);
          const snapshotPackagesMap = await snapshotPackages([
            ...allPackageIds,
          ]);

          items = updates.items.map((it) => ({
            personName: it.personName,
            programs: it.programs.map((p) => {
              const s = snapshotProgramsMap.get(p.programId);
              if (!s) {
                const e: any = new Error(`Program not found: ${p.programId}`);
                e.statusCode = 400;
                throw e;
              }
              return {
                programId: p.programId,
                qty: p.qty,
                priceSnapshot: s.price,
                nameSnapshot: s.name,
                durationSnapshot: s.durationMinutes,
                currencySnapshot: s.currency,
              };
            }),
            packages: it.packages.map((p) => {
              const s = snapshotPackagesMap.get(p.packageId);
              console.log("test", p);
              if (!s) {
                const e: any = new Error(`Package not found: ${p.packageId}`);
                e.statusCode = 400;
                throw e;
              }
              return {
                packageId: p.packageId,
                priceSnapshot: s.packagePrice,
                nameSnapshot: s.name,
                originalPriceSnapshot: s.originalPrice,
                numberOfPeopleSnapshot: s.numberOfPeople,
                durationSnapshot: s.durationMinutes,
                currencySnapshot: s.currency,
              };
            }),
          }));
          console.debug("Updated items:", items);
        }

        if (updates.arrivalAt) {
          arrivalAt = Timestamp.fromDate(new Date(updates.arrivalAt));
        }

        const totals = computeTotals(items);

        trx.update(ref, {
          arrivalAt,
          items,
          contact: updates.contact ?? data.contact,
          note: updates.note ?? data.note,
          partySize: items.length,
          totals,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      const fresh = await ref.get();
      res.json({ id: fresh.id, ...fresh.data() });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/confirm",
  requireRole(["admin", "staff"]),
  async (req: any, res, next) => {
    try {
      const ref = col.doc(req.params.id);
      await db.runTransaction(async (trx) => {
        const snap = await trx.get(ref);
        if (!snap.exists) throw new Error("Booking not found");
        const data = snap.data() as any;
        assertTransition(data.status, "confirmed");
        trx.update(ref, {
          status: "confirmed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      const fresh = await ref.get();
      const compileTemplate = await generateEmail("booking-confirmed.hbs", {
        name: fresh.data()?.contact?.name,
        companyName: "Deflora spa",
        date: new Date(fresh.data()?.arrivalAt?.toDate()).toLocaleDateString(),
        guests: fresh
          .data()
          ?.items.map((it: { personName: any; programs: any[] }) => ({
            name: it.personName,
            programs: it.programs.map((p) => p.nameSnapshot),
          })),
        year: new Date().getFullYear(),
      });
      await sendEmail(
        fresh.data()?.contact?.email,
        `Spa appointment confirmed Booking ID: ${fresh.id}`,
        compileTemplate
      );
      res.json({ id: fresh.id, ...fresh.data() });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/cancel",
  requireRole(["admin", "staff"]),
  async (req: any, res, next) => {
    try {
      const ref = col.doc(req.params.id);
      await db.runTransaction(async (trx) => {
        const snap = await trx.get(ref);
        if (!snap.exists) throw new Error("Booking not found");
        const data = snap.data() as any;
        assertTransition(data.status, "canceled");
        trx.update(ref, {
          status: "canceled",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      const fresh = await ref.get();
      const compileTemplate = await generateEmail("booking-canceled.hbs", {
        name: fresh.data()?.contact?.name,
        companyName: "Deflora spa",
        date: new Date(fresh.data()?.arrivalAt?.toDate()).toLocaleDateString(),
        guests: fresh
          .data()
          ?.items.map((it: { personName: any; programs: any[] }) => ({
            name: it.personName,
            programs: it.programs.map((p) => p.nameSnapshot),
          })),
        year: new Date().getFullYear(),
      });
      await sendEmail(
        fresh.data()?.contact?.email,
        `Spa appointment canceled Booking ID: ${fresh.id}`,
        compileTemplate
      );
      res.json({ id: fresh.id, ...fresh.data() });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
