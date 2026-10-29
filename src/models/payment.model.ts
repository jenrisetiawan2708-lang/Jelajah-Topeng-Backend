import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";

export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

export type PaymentDTO = {
  id: string;
  orderId: string;
  itemName: string;
  amount: number;
  status: PaymentStatus;
  paymentType: string | null;
  snapToken: string;
  redirectUrl: string;
  createdAt: string;
  updatedAt: string;
};

interface PaymentRow extends RowDataPacket {
  id: string;
  user_id: string;
  order_id: string;
  item_name: string;
  amount: number;
  status: PaymentStatus;
  payment_type: string | null;
  snap_token: string;
  redirect_url: string;
  created_at: Date;
  updated_at: Date;
}

// user_id & raw_notification tidak ikut keluar.
const toDTO = (r: PaymentRow): PaymentDTO => ({
  id: r.id,
  orderId: r.order_id,
  itemName: r.item_name,
  amount: r.amount,
  status: r.status,
  paymentType: r.payment_type,
  snapToken: r.snap_token,
  redirectUrl: r.redirect_url,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
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
  await pool.execute(
    `INSERT INTO payments
      (id, user_id, order_id, item_name, amount, status, snap_token, redirect_url,
       customer_name, customer_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(), input.userId, input.orderId, input.itemName, input.amount,
      input.snapToken, input.redirectUrl,
      input.customerName ?? null, input.customerEmail ?? null, now, now,
    ],
  );
  return (await findOwned(input.userId, input.orderId)) as PaymentDTO;
}

export async function listByUser(userId: string): Promise<PaymentDTO[]> {
  const [rows] = await pool.execute<PaymentRow[]>(
    "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return rows.map(toDTO);
}

export async function findOwned(userId: string, orderId: string): Promise<PaymentDTO | null> {
  const [rows] = await pool.execute<PaymentRow[]>(
    "SELECT * FROM payments WHERE order_id = ? AND user_id = ?",
    [orderId, userId],
  );
  return rows[0] ? toDTO(rows[0]) : null;
}

// Dipakai webhook Midtrans (tanpa login user, diverifikasi lewat signature).
export async function findByOrderId(orderId: string): Promise<{ amount: number } | null> {
  const [rows] = await pool.execute<PaymentRow[]>(
    "SELECT * FROM payments WHERE order_id = ?",
    [orderId],
  );
  return rows[0] ? { amount: rows[0].amount } : null;
}

export async function updateStatus(
  orderId: string,
  status: PaymentStatus,
  paymentType: string | null,
  raw: string,
) {
  await pool.execute(
    `UPDATE payments
     SET status = ?, payment_type = ?, raw_notification = ?, updated_at = ?
     WHERE order_id = ?`,
    [status, paymentType, raw, new Date(), orderId],
  );
}