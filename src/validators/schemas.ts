import { z } from "zod";

export const ProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: z.string().default("THB"),
  isActive: z.boolean().default(true),
});

export type ProgramInput = z.infer<typeof ProgramSchema>;

const BookingItemSchema = z.object({
  personName: z.string().min(1),
  programs: z
    .array(
      z.object({
        programId: z.string().min(1),
        qty: z.number().int().positive().default(1),
        // snapshot optional; will be filled by server at creation/update
        priceSnapshot: z.number().nonnegative().optional(),
        nameSnapshot: z.string().optional(),
        durationSnapshot: z.number().int().positive().optional(),
        currencySnapshot: z.string().optional(),
      })
    )
    .min(1),
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

export const AnalyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
