import { db } from "../config/firebase.js";

type ProgramDoc = {
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
};

export async function snapshotPrograms(programIds: string[]) {
  if (programIds.length === 0) return new Map<string, ProgramDoc>();
  const refs = programIds.map((id) => db.collection("programs").doc(id));
  const snaps = await db.getAll(...refs);
  const map = new Map<string, ProgramDoc>();
  snaps.forEach((s, idx) => {
    if (s.exists) {
      const d = s.data() as any;
      if (!programIds[idx]) {
        console.error(
          `snapshotPrograms: Program ID ${programIds[idx]} not found`
        );
        return;
      }
      map.set(programIds[idx], {
        name: d.name,
        durationMinutes: d.durationMinutes,
        price: d.price,
        currency: d.currency ?? "THB",
        isActive: d.isActive ?? true,
      });
    }
  });
  return map;
}

export function computeTotals(
  items: Array<{
    programs: Array<{ qty: number; priceSnapshot: number }>;
  }>
) {
  let subtotal = 0;
  for (const it of items) {
    for (const p of it.programs) {
      subtotal += (p.priceSnapshot ?? 0) * p.qty;
    }
  }
  return { subtotal, grandTotal: subtotal };
}
