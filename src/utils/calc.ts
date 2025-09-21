import { db } from "../config/firebase.js";
import type { ProgramDoc, PackageDoc } from "./docTypes.js";

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
        type: d.type,
        durationOptions: d.durationOptions,
        currency: d.currency ?? "THB",
        isActive: d.isActive ?? true,
      });
    }
  });
  return map;
}

export async function snapshotPackages(packageIds: string[]) {
  if (packageIds.length === 0) return new Map<string, PackageDoc>();
  const refs = packageIds.map((id) => db.collection("packages").doc(id));
  const snaps = await db.getAll(...refs);
  const map = new Map<string, PackageDoc>();
  snaps.forEach((s, idx) => {
    if (s.exists) {
      const d = s.data() as any;
      if (!packageIds[idx]) {
        console.error(
          `snapshotPrograms: Program ID ${packageIds[idx]} not found`
        );
        return;
      }
      map.set(packageIds[idx], {
        name: d.name,
        description: d.description,
        packagePrice: d.packagePrice,
        numberOfPeople: d.numberOfPeople,
        durationMinutes: d.durationMinutes,
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
    packages: Array<{ priceSnapshot: number }>;
  }>
) {
  let subtotal = 0;
  for (const it of items) {
    for (const p of it.programs) {
      subtotal += (p.priceSnapshot ?? 0) * p.qty;
    }
    for (const p of it.packages) {
      subtotal += p.priceSnapshot ?? 0;
    }
  }
  return { subtotal, grandTotal: subtotal };
}
