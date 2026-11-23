import { z } from "zod";
import { dueDateSchema } from "../utils/dates.js";

const bookIdSchema = z
  .string({ error: "Select a book" })
  .regex(/^[0-9a-fA-F]{24}$/, "Select a valid book");

const quantitySchema = z
  .number({ error: "Quantity must be a number" })
  .int("Quantity must be a whole number")
  .min(1, "At least 1");

// ── Truly Optional Reason Schema ──
// Khali (blank) ho toh accept karega, aur agar likha ho toh 5-500 characters hona chahiye
const reasonSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine(
    (val) => !val || val.length >= 5,
    "If provided, reason must be at least 5 characters"
  )
  .refine(
    (val) => !val || val.length <= 500,
    "Max 500 characters"
  );

const requestFields = {
  bookId: bookIdSchema,
  quantity: quantitySchema,
  neededUntil: dueDateSchema,
  reason: reasonSchema,

  // ── Digital Access Fields (Zod inko ab strip nahi karega) ──
  accessMode: z.enum(["physical", "digital"]).optional(),
  digitalPlan: z.enum(["day", "week", "year", "lifetime"]).optional(),
  paymentMode: z.enum(["credits", "cash"]).optional(),
  creditCost: z.coerce.number().optional(),
};

export const createRequestSchema = z.object(requestFields).passthrough();
export const updateRequestSchema = z.object(requestFields).passthrough();

export const reviewRequestSchema = z
  .object({
    status: z.enum(["approved", "rejected", "counter_offered"], {
      error: "Status must be approved, rejected, or counter_offered",
    }),
    proposedDate: z.coerce.date().optional(),
    reviewNote: z.string().trim().max(300, "Max 300 characters").optional(),
  })
  .refine((d) => d.status !== "counter_offered" || d.proposedDate, {
    message: "Pick the date you can give the book until",
    path: ["proposedDate"],
  })
  .refine((d) => d.status !== "rejected" || (d.reviewNote && d.reviewNote.length > 0), {
    message: "Review note is required when rejecting",
    path: ["reviewNote"],
  });