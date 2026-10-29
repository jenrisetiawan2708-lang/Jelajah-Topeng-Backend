import crypto from "node:crypto";
import { env } from "../config/env";
import { currentUser } from "../middleware/verifyToken";
import * as payments from "../models/payment.model";
import type { PaymentStatus } from "../models/payment.model";
import type { CheckoutInput } from "../validators/payment.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

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
function mapStatus(transactionStatus?: string, fraudStatus?: string): PaymentStatus {
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

// GET /api/payments
export const list = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await payments.listByUser(user.id), "Data pembayaran berhasil diambil");
});

// POST /api/payments/checkout  -> buat transaksi Snap, kembalikan token + redirectUrl
export const checkout = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const { amount, itemName, customerName, customerEmail } = req.body as CheckoutInput;

  const orderId = `JT-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  const response = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: midtransAuth(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [
        { id: "item-1", price: amount, quantity: 1, name: itemName.slice(0, 50) },
      ],
      customer_details: {
        first_name: customerName ?? "Pengunjung",
        email: customerEmail,
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

  const payment = await payments.create({
    userId: user.id,
    orderId,
    itemName,
    amount,
    snapToken: json.token,
    redirectUrl: json.redirect_url,
    customerName,
    customerEmail,
  });

  res.success(payment, "Tagihan pembayaran dibuat", 201);
});

// POST /api/payments/notification  <- dipanggil Midtrans (webhook), tanpa login.
// Keamanannya: signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
export const handleNotification = asyncHandler(async (req, res) => {
  if (!env.MIDTRANS_SERVER_KEY) throw new AppError(503, "Midtrans belum dikonfigurasi");

  const p = req.body as Partial<MidtransPayload>;
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

  res.success({ orderId: p.order_id, status }, "Notifikasi diproses");
});

// GET /api/payments/:orderId/status  -> tanya status langsung ke Midtrans.
// Berguna di localhost, karena webhook Midtrans tidak bisa menjangkau komputermu.
export const syncStatus = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const orderId = String(req.params.orderId);

  const payment = await payments.findOwned(user.id, orderId);
  if (!payment) throw new AppError(404, "Pembayaran tidak ditemukan");

  const response = await fetch(`${API_BASE}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: midtransAuth() },
    signal: AbortSignal.timeout(15_000),
  });
  const p = (await response.json()) as Partial<MidtransPayload>;

  // 404 = pelanggan belum memilih metode bayar di halaman Snap
  if (p.status_code === "404" || !p.transaction_status) {
    return res.success(payment, "Belum ada transaksi di Midtrans (metode bayar belum dipilih)");
  }

  const status = mapStatus(p.transaction_status, p.fraud_status);
  await payments.updateStatus(orderId, status, p.payment_type ?? null, JSON.stringify(p));

  res.success(await payments.findOwned(user.id, orderId), "Status diperbarui dari Midtrans");
});