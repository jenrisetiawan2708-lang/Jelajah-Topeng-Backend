import { randomUUID } from "node:crypto";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { orm } from "../db/orm";
import { payments, type PaymentStatus } from "../db/schema";

export type { PaymentStatus };

export type PaymentDTO = {
  id: string;
  orderId: string;
  itemName: string;
  amount: number;
  status: PaymentStatus;
  paymentType: string | null;
  snapToken: string;
  redirectUrl: string;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentRow = typeof payments.$inferSelect;

// userId & rawNotification tidak ikut keluar.
const toDTO = (r: PaymentRow): PaymentDTO => ({
  id: r.id,
  orderId: r.orderId,
  itemName: r.itemName,
  amount: r.amount,
  status: r.status,
  paymentType: r.paymentType,
  snapToken: r.snapToken,
  redirectUrl: r.redirectUrl,
  customerName: r.customerName,
  customerEmail: r.customerEmail,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export async function create(input: {
  userId: string;
  orderId: string;
  itemName: string;
  amount: number;
  snapToken: string;
  redirectUrl: string;
  customerName?: string;
  customerEmail?: string;
}): Promise<PaymentDTO> {
  const now = new Date();
  await orm.insert(payments).values({
    id: randomUUID(),
    userId: input.userId,
    orderId: input.orderId,
    itemName: input.itemName,
    amount: input.amount,
    status: "pending",
    snapToken: input.snapToken,
    redirectUrl: input.redirectUrl,
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return (await findOwned(input.userId, input.orderId)) as PaymentDTO;
}

// Admin: semua transaksi semua pengunjung.
export async function listAll(): Promise<PaymentDTO[]> {
  const rows = await orm.select().from(payments).orderBy(desc(payments.createdAt));
  return rows.map(toDTO);
}

// Pengunjung: hanya transaksi miliknya.
export async function listByUser(userId: string): Promise<PaymentDTO[]> {
  const rows = await orm
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
  return rows.map(toDTO);
}

export async function findOwned(userId: string, orderId: string): Promise<PaymentDTO | null> {
  const rows = await orm
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.userId, userId)))
    .limit(1);
  return rows[0] ? toDTO(rows[0]) : null;
}

// Admin boleh melihat transaksi siapa pun.
export async function findAny(orderId: string): Promise<PaymentDTO | null> {
  const rows = await orm
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  return rows[0] ? toDTO(rows[0]) : null;
}

// Dipakai webhook Midtrans (tanpa login user, diverifikasi lewat signature).
export async function findByOrderId(orderId: string): Promise<{ amount: number } | null> {
  const rows = await orm
    .select({ amount: payments.amount })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateStatus(
  orderId: string,
  status: PaymentStatus,
  paymentType: string | null,
  raw: string,
) {
  await orm
    .update(payments)
    .set({ status, paymentType, rawNotification: raw, updatedAt: new Date() })
    .where(eq(payments.orderId, orderId));
}

export type RemoveResult = "ok" | "not_found" | "locked";

// Admin menghapus tagihan. Transaksi lunas / dikembalikan dikunci karena
// dipakai untuk angka pendapatan di dashboard.
export async function removeAny(orderId: string): Promise<RemoveResult> {
  const existing = await findAny(orderId);
  if (!existing) return "not_found";
  if (existing.status === "paid" || existing.status === "refunded") return "locked";

  const [result] = await orm
    .delete(payments)
    .where(and(eq(payments.orderId, orderId), notInArray(payments.status, ["paid", "refunded"])));
  return result.affectedRows > 0 ? "ok" : "not_found";
}