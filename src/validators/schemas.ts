import { z } from "zod";

/** ===== Programs (with default + options) ===== */
export const ProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["massage", "facial", "treatment"]).default("massage"),
  durationOptions: z
    .array(
      z.object({
        durationMinutes: z.number().int().positive(),
        price: z.number().nonnegative(),
      })
    )
    .min(1),
  currency: z.string().default("THB"),
  isActive: z.boolean().default(true),
});

export type ProgramInput = z.infer<typeof ProgramSchema>;

export const PackageSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  originalPrice: z.number().nonnegative(),
  packagePrice: z.number().nonnegative(),
  numberOfPeople: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  currency: z.string().default("THB"),
  isActive: z.boolean().default(true),
});
export type PackageInput = z.infer<typeof PackageSchema>;

/** ===== Program/Package selections with duration choice ===== **/

export const BookingProgramSelectionSchema = z.object({
  programId: z.string().min(1),
  qty: z.number().int().positive().default(1),

  // optional snapshots (server may populate to freeze pricing/names at booking time)
  durationSnapshot: z.number().int().positive().optional(),
  priceSnapshot: z.number().nonnegative().optional(),
  nameSnapshot: z.string().optional(),
  currencySnapshot: z.string().optional(),
});

export const BookingPackageSelectionSchema = z.object({
  packageId: z.string().min(1),
  qty: z.number().int().positive().default(1),

  // optional snapshots (server may populate to freeze pricing/names at booking time)
  nameSnapshot: z.string().optional(),
  originalPriceSnapshot: z.number().nonnegative().optional(),
  packagePriceSnapshot: z.number().nonnegative().optional(),
  numberOfPeopleSnapshot: z.number().int().positive().optional(),
  durationSnapshot: z.number().int().positive().optional(),
  currencySnapshot: z.string().optional(),
});

export const BookingItemSchema = z
  .object({
    personName: z.string().min(1),
    programs: z.array(BookingProgramSelectionSchema).default([]),
    packages: z.array(BookingPackageSelectionSchema).default([]),
  })
  .refine((v) => (v.packages?.length ?? 0) + (v.programs?.length ?? 0) > 0, {
    message: "Each person must select at least one package or program.",
    path: ["packages"],
  });

export const BookingCreateSchema = z.object({
  arrivalAt: z.string().datetime(), // ISO string from client
  contact: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  items: z.array(BookingItemSchema).min(1),
  note: z.string().max(2000).optional(),
});

export const BookingUpdateDetailsSchema = z.object({
  arrivalAt: z.string().datetime().optional(),
  contact: z
    .object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  items: z.array(BookingItemSchema).min(1).optional(),
  note: z.string().max(2000).optional(),
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof BookingUpdateDetailsSchema>;

export type BookingItemInput = z.infer<typeof BookingItemSchema>;
export type BookingProgramSelectionInput = z.infer<
  typeof BookingProgramSelectionSchema
>;
export type BookingPackageSelectionInput = z.infer<
  typeof BookingPackageSelectionSchema
>;

/** ===== Analytics (unchanged) ===== */
export const AnalyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
