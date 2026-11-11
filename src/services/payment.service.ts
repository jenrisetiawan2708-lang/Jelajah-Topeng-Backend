import crypto from "node:crypto";
import { env } from "../config/env";
import type { AuthUser } from "../middleware/verifyToken";
import * as payments from "../models/payment.model";
import type { PaymentDTO, PaymentStatus } from "../models/payment.model";
import * as users from "../models/user.model";
import type { CheckoutInput } from "../validators/payment.validator";
import { AppError } from "../utils/AppError";

// Midtrans Snap (Sandbox / Production)
const SNAP_URL = env.midtransIsProduction
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";
const API_BASE = env.midtransIsProduction
  ? "https://api.midtrans.com"
  : "https://api.sandbox.midtrans.com";

type MidtransPayload = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  signature_key?: string;
};

function midtransAuth(): string {
  if (!env.MIDTRANS_SERVER_KEY) {
    throw new AppError(503, "Midtrans belum dikonfigurasi (MIDTRANS_SERVER_KEY kosong)");
  }
  // Basic Auth: ServerKey sebagai username, password kosong
  return "Basic " + Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64");
}

// Status Midtrans -> status internal
export function mapStatus(transactionStatus?: string, fraudStatus?: string): PaymentStatus {
  switch (transactionStatus) {
    case "settlement":
      return "paid";
    case "capture":
      return fraudStatus === "accept" ? "paid" : "pending";
    case "deny":
    case "cancel":
    case "failure":
      return "failed";
    case "expire":
      return "expired";
    case "refund":
    case "partial_refund":
    case "chargeback":
      return "refunded";
    default:
      return "pending";
  }
}

const sha512 = (value: string) => crypto.createHash("sha512").update(value).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Pengunjung atau admin membuat tagihan -> tautan pembayaran Snap.
export async function checkout(user: AuthUser, input: CheckoutInput): Promise<PaymentDTO> {
  let buyerName = input.customerName;
  let buyerEmail = input.customerEmail;

  // Pengunjung: identitas pembeli diambil dari akunnya, bukan dari input.
  if (user.role === "user") {
    const profile = await users.findById(user.id);
    if (!profile) throw new AppError(401, "Akun tidak ditemukan");
    buyerName = profile.name;
    buyerEmail = profile.email;
  }

  const orderId = `JT-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  const response = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: midtransAuth(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: input.amount },
      item_details: [
        { id: "item-1", price: input.amount, quantity: 1, name: input.itemName.slice(0, 50) },
      ],
      customer_details: {
        first_name: buyerName ?? "Pengunjung",
        email: buyerEmail,
      },
      callbacks: { finish: `${env.APP_BASE_URL}/dashboard` },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await response.json()) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
  };

  if (!response.ok || !json.token || !json.redirect_url) {
    throw new AppError(
      502,
      `Midtrans menolak permintaan: ${json.error_messages?.join(", ") ?? response.status}`,
    );
  }

  return payments.create({
    userId: user.id,
    orderId,
    itemName: input.itemName,
    amount: input.amount,
    snapToken: json.token,
    redirectUrl: json.redirect_url,
    customerName: buyerName,
    customerEmail: buyerEmail,
  });
}

// Webhook Midtrans (tanpa login). signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
export async function applyNotification(
  p: Partial<MidtransPayload>,
): Promise<{ orderId: string; status: PaymentStatus }> {
  if (!env.MIDTRANS_SERVER_KEY) throw new AppError(503, "Midtrans belum dikonfigurasi");

  if (!p.order_id || !p.status_code || !p.gross_amount || !p.signature_key) {
    throw new AppError(400, "Payload notifikasi tidak lengkap");
  }

  const expected = sha512(p.order_id + p.status_code + p.gross_amount + env.MIDTRANS_SERVER_KEY);
  if (!safeEqual(expected, p.signature_key)) {
    throw new AppError(403, "Signature tidak valid");
  }

  const payment = await payments.findByOrderId(p.order_id);
  if (!payment) throw new AppError(404, "Order tidak ditemukan");

  if (Math.round(Number(p.gross_amount)) !== payment.amount) {
    throw new AppError(400, "Nominal tidak sesuai dengan tagihan");
  }

  const status = mapStatus(p.transaction_status, p.fraud_status);
  await payments.updateStatus(p.order_id, status, p.payment_type ?? null, JSON.stringify(p));
  return { orderId: p.order_id, status };
}

// Tanya status langsung ke Midtrans. Pengunjung hanya untuk transaksinya sendiri,
// admin untuk semua. Berguna di localhost karena webhook tidak bisa menjangkau laptop.
export async function syncStatus(
  user: AuthUser,
  orderId: string,
): Promise<{ payment: PaymentDTO; synced: boolean }> {
  const find = () =>
    user.role === "admin" ? payments.findAny(orderId) : payments.findOwned(user.id, orderId);

  const payment = await find();
  if (!payment) throw new AppError(404, "Pembayaran tidak ditemukan");

  const response = await fetch(`${API_BASE}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: midtransAuth() },
    signal: AbortSignal.timeout(15_000),
  });
  const p = (await response.json()) as Partial<MidtransPayload>;

  // 404 = pelanggan belum memilih metode bayar di halaman Snap
  if (p.status_code === "404" || !p.transaction_status) {
    return { payment, synced: false };
  }

  const status = mapStatus(p.transaction_status, p.fraud_status);
  await payments.updateStatus(orderId, status, p.payment_type ?? null, JSON.stringify(p));
  return { payment: (await find()) ?? payment, synced: true };
}