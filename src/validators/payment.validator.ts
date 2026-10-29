import { z } from "zod";
import { validateBody } from "./validate";

const checkoutSchema = z.object({
  amount: z.coerce
    .number()
    .int("Nominal harus bilangan bulat")
    .min(1000, "Nominal minimal Rp1.000")
    .max(100_000_000, "Nominal maksimal Rp100.000.000"),
  itemName: z.string().trim().min(3, "Nama item minimal 3 karakter").max(100),
  customerName: z.string().trim().max(100).optional(),
  customerEmail: z
    .string()
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Format email tidak valid")
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const validateCheckout = validateBody(checkoutSchema);