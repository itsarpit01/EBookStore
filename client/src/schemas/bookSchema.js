import { z } from "zod";

export const bookFormSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(120, "Title cannot exceed 120 characters"),
  author: z
    .string({ required_error: "Author is required" })
    .trim()
    .min(1, "Author is required")
    .max(80, "Author cannot exceed 80 characters"),
  isbn: z
    .string({ required_error: "ISBN is required" })
    .trim()
    .min(1, "ISBN is required")
    .regex(/^[0-9-]{10,17}$/, "Enter a valid 10 or 13 digit ISBN"),
  category: z.string().trim().max(50, "Max 50 characters").optional().or(z.literal("")),
  price: z.coerce
    .number({ invalid_type_error: "Price must be a number" })
    .min(0, "Price cannot be negative"),
  creditPrice: z.coerce
    .number({ invalid_type_error: "Credit price must be a number" })
    .min(0, "Credit price cannot be negative")
    .optional(),
  totalCopies: z.coerce
    .number({ invalid_type_error: "Copies must be a number" })
    .int("Must be a whole number")
    .min(1, "At least 1 copy is required"),
});