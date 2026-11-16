import { z } from "zod";

export const ticketSchema = z.object({
  category: z.enum(["general", "book", "payment", "account"], {
    errorMap: () => ({ message: "Please select a valid category" }),
  }),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(5, "Subject must be at least 5 characters")
    .max(100, "Subject cannot exceed 100 characters"),
  message: z
    .string({ required_error: "Description is required" })
    .trim()
    .min(20, "Please provide a detailed description (at least 20 characters)")
    .max(1000, "Description cannot exceed 1000 characters"),
});