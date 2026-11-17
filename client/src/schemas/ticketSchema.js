import { z } from "zod";

export const ticketSchema = z.object({
  category: z.enum(["general", "book", "payment", "account"], {
    errorMap: () => ({ message: "Please select a valid category" }),
  }),
  subject: z
    .string()
    .trim()
    .refine((val) => val.length > 0, {
      message: "Subject is required",
    })
    .refine((val) => val.length >= 5, {
      message: "Subject must be at least 5 characters",
    })
    .refine((val) => val.length <= 100, {
      message: "Subject cannot exceed 100 characters",
    }),
  message: z
    .string()
    .trim()
    .refine((val) => val.length > 0, {
      message: "Detailed description is required",
    })
    .refine((val) => val.length >= 20, {
      message: "Detailed description must be at least 20 characters",
    })
    .refine((val) => val.length <= 100, {
      message: "Description cannot exceed 1000 characters",
    }),
});