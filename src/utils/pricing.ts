import { db } from "../config/firebase.js";

type ProgramDoc = {
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive?: boolean;
};

type PackageDoc = {
  name: string;
  description: string;
  originalPrice: number;
  packagePrice: number;
  numberOfPeople: number;
  durationMinutes: number;
  currency: string;
  isActive?: boolean;
};

export async function snapshotProgram(programId: string) {
  const doc = await db.collection("programs").doc(programId).get();
  if (!doc.exists) throw new Error(`Program not found: ${programId}`);
  const p = doc.data() as ProgramDoc;
  if (p?.isActive === false) throw new Error(`Program inactive: ${programId}`);
  return {
    programId,
    nameSnapshot: p.name,
    durationSnapshot: p.durationMinutes,
    currencySnapshot: p.currency,
    priceSnapshot: p.price,
  };
}

export async function snapshotPackage(packageId: string) {
  const doc = await db.collection("packages").doc(packageId).get();
  if (!doc.exists) throw new Error(`Package not found: ${packageId}`);
  const pkg = doc.data() as PackageDoc;
  if (pkg?.isActive === false)
    throw new Error(`Package inactive: ${packageId}`);

  return {
    packageId,
    nameSnapshot: pkg.name,
    currencySnapshot: pkg.currency,
    priceSnapshot: pkg.packagePrice,
    originalPriceSnapshot: pkg.originalPrice,
    numberOfPeopleSnapshot: pkg.numberOfPeople,
    durationSnapshot: pkg.durationMinutes,
  };
}

export async function computeTotals(items: any[]) {
  // items: array of persons each with packages[] and programs[] (already snapped with priceSnapshot)
  let subtotal = 0;
  for (const person of items) {
    for (const pkg of person.packages) subtotal += pkg.priceSnapshot * pkg.qty;
    for (const prg of person.programs) subtotal += prg.priceSnapshot * prg.qty;
  }
  return { subtotal, grandTotal: subtotal };
}
