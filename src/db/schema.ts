import { datetime, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

// Definisi tabel `payments` (nama kolom di database tetap snake_case).
export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  orderId: varchar("order_id", { length: 64 }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  amount: int("amount").notNull(),
  status: varchar("status", { length: 20 }).$type<PaymentStatus>().notNull(),
  paymentType: varchar("payment_type", { length: 50 }),
  snapToken: varchar("snap_token", { length: 255 }).notNull(),
  redirectUrl: text("redirect_url").notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  rawNotification: text("raw_notification"),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
});