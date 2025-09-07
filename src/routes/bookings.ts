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
import z from "zod";
import { FieldPath } from "firebase-admin/firestore";
import {
  deleteBookingEvent,
  upsertBookingEvent,
} from "../services/bookingCalendar.js";

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

      try {
        await sendEmail(
          body.contact.email,
          "Spa appointment pending",
          compileTemplate
        );
      } catch (e) {
        console.error(`Error sending email ${e}`);
      }
    } catch (e) {
      next(e);
    }
  }
);

/** Base64 encode/decode a cursor payload safely */
const encodeToken = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");
function decodeToken<T = any>(token: string): T {
  // accept base64url and base64
  let s = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  if (pad) s += "=".repeat(pad);
  const json = Buffer.from(s, "base64").toString("utf8");
  return JSON.parse(json) as T;
}

/** compute how many pivot fields we expect based on the query's orderBy chain */
function expectedPivotCount({
  appliedRangeField,
  sortBy,
}: {
  appliedRangeField: "searchKey" | "createdAt" | null;
  sortBy: string;
}) {
  // Always include docId as the last pivot
  // If the first orderBy is the range field, include it
  // If sortBy is different from the first, include it too
  if (appliedRangeField === "searchKey") {
    return (sortBy !== "searchKey" ? 2 : 1) + 1; // [searchKey,(sortBy?) , docId]
  }
  if (appliedRangeField === "createdAt") {
    return (sortBy !== "createdAt" ? 2 : 1) + 1; // [createdAt,(sortBy?) , docId]
  }
  // no range: orderBy(sortBy) then docId
  return (sortBy ? 1 : 0) + 1; // [(sortBy?) , docId]
}

const QuerySchema = z.object({
  status: z.string().optional(), // "pending" or "pending,paid"
  from: z.string().datetime().optional(), // ISO date
  to: z.string().datetime().optional(), // ISO date
  sortBy: z.string().default("createdAt"), // index-backed field
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().min(1).max(200).optional(), // prefix search term
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  pageToken: z.string().optional(),
});

// --- helpers: serialize/restore pivot values ---
function isTimestampLike(v: any): v is {
  _seconds?: number;
  _nanoseconds?: number;
  seconds?: number;
  nanoseconds?: number;
} {
  return (
    v &&
    typeof v === "object" &&
    ((typeof v._seconds === "number" && typeof v._nanoseconds === "number") ||
      (typeof v.seconds === "number" && typeof v.nanoseconds === "number"))
  );
}

function reviveToTimestamp(v: any): FirebaseFirestore.Timestamp {
  if (v instanceof Timestamp) return v;
  if (typeof v === "number") return Timestamp.fromMillis(v);
  if (typeof v === "string") {
    // ISO string support (future-proof)
    const d = new Date(v);
    if (!isNaN(+d)) return Timestamp.fromDate(d);
  }
  if (isTimestampLike(v)) {
    const sec = (v._seconds ?? v.seconds) || 0;
    const nsec = (v._nanoseconds ?? v.nanoseconds) || 0;
    const ms = sec * 1000 + Math.floor(nsec / 1e6);
    return Timestamp.fromMillis(ms);
  }
  // Fall back (will likely error later, but at least explicit)
  throw new Error("Cannot revive value to Firestore Timestamp");
}

function serializePivotValue(v: any) {
  // Preserve primitives as-is; convert Firestore Timestamp to millis
  if (v instanceof Timestamp) return v.toMillis();
  return v;
}

/** Which pivot indices are timestamps for a given query plan */
function timestampPivotIndexes(
  appliedRangeField: "searchKey" | "createdAt" | null,
  sortBy: string
) {
  // order chain we build:
  // [rangeField?] -> [sortBy if different?] -> [__name__]
  // Return the indices (0-based) that correspond to timestamps
  const idxs: number[] = [];
  let i = 0;
  if (appliedRangeField === "createdAt") {
    idxs.push(i++); // createdAt first
    if (sortBy !== "createdAt") {
      if (sortBy === "createdAt") idxs.push(i); // unreachable, kept for clarity
      i++;
    }
  } else if (appliedRangeField === "searchKey") {
    i++; // searchKey (string)
    if (sortBy !== "searchKey") {
      if (sortBy === "createdAt") idxs.push(i);
      i++;
    }
  } else {
    // no range
    if (sortBy === "createdAt") idxs.push(i);
    i++;
  }
  // docId at the end (never a timestamp)
  return idxs;
}

router.get("/", requireRole(["admin", "staff"]), async (req, res, next) => {
  try {
    const params = QuerySchema.parse(req.query);

    const { status, from, to, sortBy, sortDir, q, pageSize, pageToken } =
      params;

    // Parse dates
    const fromTs = from ? Timestamp.fromDate(new Date(from)) : undefined;
    const toTs = to ? Timestamp.fromDate(new Date(to)) : undefined;

    // Start building query
    // Important: Firestore needs range filters FIRST in order chain, and if you use range
    // on field X, you must also orderBy X before others.
    let qref: FirebaseFirestore.Query = col;

    // Status filter(s)
    if (status) {
      const statuses = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        qref = qref.where("status", "==", statuses[0]);
      } else if (statuses.length <= 10) {
        qref = qref.where("status", "in", statuses);
      } else {
        // Firestore 'in' supports max 10 values; fall back to first 10.
        qref = qref.where("status", "in", statuses.slice(0, 10));
      }
    }

    // Search (prefix) vs date range: only one range field allowed.
    // If 'q' present, we search on 'searchKey' (precomputed, e.g., UPPER(name/code)).
    // NOTE: You must maintain `searchKey` alongside your document.
    let appliedRangeField: "searchKey" | "createdAt" | null = null;

    if (q) {
      const term = q.trim();
      const upper = term.toUpperCase();
      const upperEnd = upper + "\uf8ff";

      // example: search only by name
      const field = "contact.name";
      qref = qref.where(field, ">=", upper).where(field, "<", upperEnd);

      appliedRangeField = "searchKey";
    } else {
      if (fromTs) {
        qref = qref.where("createdAt", ">=", fromTs);
        appliedRangeField = "createdAt";
      }
      if (toTs) {
        qref = qref.where("createdAt", "<=", toTs);
        appliedRangeField = "createdAt";
      }
    }

    // OrderBy rules:
    // - If we used a range on field F, we must orderBy F first.
    // - Then orderBy requested sortBy if different.
    // - Always add __name__ as a deterministic tiebreaker (required for cursor paging too).
    if (appliedRangeField === "searchKey") {
      qref = qref.orderBy(
        "searchKey",
        sortDir as FirebaseFirestore.OrderByDirection
      );
      if (sortBy !== "searchKey") qref = qref.orderBy(sortBy, sortDir as any);
    } else if (appliedRangeField === "createdAt") {
      // Ensure createdAt is first
      if (sortBy !== "createdAt") {
        qref = qref
          .orderBy("createdAt", sortDir as any)
          .orderBy(sortBy, sortDir as any);
      } else {
        qref = qref.orderBy("createdAt", sortDir as any);
      }
    } else {
      // No range filter used; free to order by requested field
      qref = qref.orderBy(sortBy, sortDir as any);
    }
    // Always add doc id tiebreaker for stable sort & cursor
    qref = qref.orderBy(FieldPath.documentId(), sortDir as any);
    // Paging via pageToken (opaque)
    // Token payload contains the last doc’s pivot fields in the same order as orderBy
    if (pageToken) {
      try {
        const cursor = decodeToken<{ pivot: unknown[]; v?: number }>(
          String(pageToken)
        );

        if (!cursor || !Array.isArray(cursor.pivot)) {
          return res
            .status(400)
            .json({ error: "Invalid pageToken: no pivot array" });
        }

        const expected = expectedPivotCount({ appliedRangeField, sortBy });
        if (cursor.pivot.length !== expected) {
          return res.status(400).json({
            error: "Invalid pageToken for current query parameters",
            details: { expectedPivot: expected, got: cursor.pivot.length },
          });
        }

        // revive timestamp pivots
        const tsIdxs = timestampPivotIndexes(appliedRangeField, sortBy);
        const pivot = cursor.pivot.map((v, i) =>
          tsIdxs.includes(i) ? reviveToTimestamp(v) : v
        );

        qref = qref.startAfter(...pivot);
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Malformed pageToken" });
      }
    }

    // Fetch one extra to know if there is a next page
    const snap = await qref.limit(pageSize + 1).get();
    const docs = snap.docs.slice(0, pageSize);
    const hasMore = snap.size > pageSize;

    // Build nextPageToken from the last doc (mirrors the orderBy chain)
    let nextPageToken: string | undefined;
    if (hasMore) {
      const last = docs[docs.length - 1];
      const lastData = last?.data() as any;

      const pivot: any[] = [];
      if (appliedRangeField === "searchKey") {
        pivot.push(lastData.searchKey ?? "");
        if (sortBy !== "searchKey")
          pivot.push(serializePivotValue(lastData[sortBy] ?? null));
      } else if (appliedRangeField === "createdAt") {
        pivot.push(serializePivotValue(lastData.createdAt ?? null));
        if (sortBy !== "createdAt")
          pivot.push(serializePivotValue(lastData[sortBy] ?? null));
      } else {
        if (sortBy) pivot.push(serializePivotValue(lastData[sortBy] ?? null));
      }
      pivot.push(last?.id);
      nextPageToken = encodeToken({ v: 1, pivot });
    }
    // Map docs safely (timestamps → ISO). Guard against undefined.
    const items = docs.map((d) => {
      const data = d.data() as any;
      const arrivalAtIso = data?.arrivalAt?.toDate
        ? data.arrivalAt.toDate().toISOString()
        : null;
      const createdAtIso = data?.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : null;

      return {
        id: d.id,
        ...data,
        arrivalAt: arrivalAtIso,
        createdAt: createdAtIso,
      };
    });
    // If we ignored date range due to search, signal that politely.
    const meta: Record<string, any> = {
      sortBy,
      sortDir,
      pageSize,
      hasMore,
      ...(q && (from || to)
        ? {
            notice:
              "Date filters (from/to) were ignored because a text search (q) was applied. Firestore only allows range filters on one field per query.",
          }
        : null),
    };

    res.json({ items, nextPageToken, meta });
  } catch (err) {
    // zod or runtime
    if (err instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Invalid query params", details: err.flatten() });
    } else {
      next(err);
    }
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

      try {
        await upsertBookingEvent(ref);
      } catch (e) {
        console.error(`Error upsertBookingEvent: ${e}`);
      }

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
      const data = fresh.data() as any;

      const templateData = {
        name: data.contact?.name,
        companyName: "Deflora spa",
        date: new Date(data.arrivalAt.toDate()).toLocaleDateString(),
        guests: data.items.map((it: { personName: any; programs: any[] }) => ({
          name: it.personName,
          programs: it.programs.map((p) => p.nameSnapshot),
        })),
        year: new Date().getFullYear(),
      };
      const compileTemplate = await generateEmail(
        "booking-confirmed.hbs",
        templateData
      );
      try {
        await upsertBookingEvent(ref);
      } catch (e) {
        console.error(`Error upsertBookingEvent: ${e}`);
      }

      try {
        await sendEmail(
          data.contact?.email,
          `Spa appointment confirmed Booking ID: ${req.params.id}`,
          compileTemplate
        );
      } catch (error: any) {}

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
      const data = fresh.data() as any;
      const compileTemplate = await generateEmail("booking-canceled.hbs", {
        name: data?.contact?.name,
        companyName: "Deflora spa",
        date: new Date(data?.arrivalAt?.toDate()).toLocaleDateString(),
        guests: data.items.map((it: { personName: any; programs: any[] }) => ({
          name: it.personName,
          programs: it.programs.map((p) => p.nameSnapshot),
        })),
        year: new Date().getFullYear(),
      });

      try {
        await deleteBookingEvent(ref);
      } catch (e) {
        console.error(`Error deleteBookingEvent: ${e}`);
      }

      try {
        await sendEmail(
          data?.contact?.email,
          `Spa appointment canceled Booking ID: ${req.params.id}`,
          compileTemplate
        );
      } catch (error: any) {}

      res.json({ id: fresh.id, ...fresh.data() });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
