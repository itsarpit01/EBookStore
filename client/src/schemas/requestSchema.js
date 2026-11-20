import { z } from "zod";
import { makeDueDateField } from "./issueSchema";

export const makeRequestFormSchema = (maxQty, maxDays) =>
  z.object({
    bookId: z.string().min(1, "Select a book"),
    quantity: z.coerce
      .number({ error: "Quantity must be a number" })
      .int("Quantity must be a whole number")
      .min(1, "At least 1")
      .max(maxQty || 1, maxQty ? `Library has only ${maxQty} copies` : "Select a book first"),
    neededUntil: makeDueDateField(maxDays),
    // ── Truly Optional Reason: Khali chhodne par koi error nahi aayega ──
    reason: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (val) => {
          if (!val || val.trim().length === 0) return true; // Optional: Khali hone par allow karega
          return val.length >= 10;
        },
        "If provided, reason must be at least 10 characters"
      )
      .refine(
        (val) => {
          if (!val || val.trim().length === 0) return true;
          return val.length <= 500;
        },
        "Max 500 characters"
      )
      // Agar kuch likha ho toh do meaningful words hone chahiye
      .refine(
        (val) => {
          if (!val || val.trim().length === 0) return true;
          return /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(val);
        },
        "Reason must contain at least two meaningful words"
      )
      // No more than 20% special characters
      .refine(
        (val) => {
          if (!val || val.trim().length === 0) return true;
          const specialCount = (val.match(/[^a-zA-Z0-9\s]/g) || []).length;
          return specialCount / val.length <= 0.2;
        },
        "Reason contains too many special characters"
      )
      // Random keyboard spam (e.g. "aaaaaa") prevention
      .refine(
        (val) => {
          if (!val || val.trim().length === 0) return true;
          return !/(.)\1{3,}/.test(val);
        },
        "Reason looks like random keyboard input — please describe your need clearly"
      ),
  });

export const reviewSchema = z.object({
  reviewNote: z.string().trim().max(300, "Max 300 characters"),
});