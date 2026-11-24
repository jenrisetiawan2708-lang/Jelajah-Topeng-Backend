import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";

export type CreateRefundInput = {
  orderId: string;
  reason: string;
  note: string;
  visitAt: string;
  tickets: number;
  methodType: "bank" | "ewallet";
  provider: string;
  accountNumber: string;
  accountOwner: string;
};

export type AppRefundDTO = {
  id: string;
  code: string;
  orderId: string;
  status: string;
  percent: number;
  amount: number;
  reason: string;
  reasonDetail: string;
  method: string;
  accountProvider: string;
  accountNumberMasked: string;
  accountOwner: string;
  rejectReason: string;
  filedAt: string;
  decidedAt: string | null;
};

export type CreateResult =
  | { ok: true; refund: AppRefundDTO }
  | { ok: false; error: "not_found" | "not_paid" | "duplicate" | "not_allowed" };

interface PaymentRow extends RowDataPacket {
  id: string;
  order_id: string;
  user_id: string;
  item_name: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  customer_name: string | null;
  customer_email: string | null;
}

interface Row extends RowDataPacket {
  id: string;
  code: string;
  order_id: string | null;
  status: string;
  percent: number | null;
  amount: number;
  reason: string;
  reason_detail: string;
  method: string;
  account_provider: string | null;
  account_number: string | null;
  account_owner: string | null;
  reject_reason: string;
  filed_at: Date;
  decided_at: Date | null;
}

const mask = (n: string | null) =>
  n && n.length > 4 ? `****${n.slice(-4)}` : n ?? "";

const toDTO = (r: Row): AppRefundDTO => ({
  id: r.id,
  code: r.code,
  orderId: r.order_id ?? "",
  status: r.status,
  percent: r.percent ?? 0,
  amount: r.amount,
  reason: r.reason,
  reasonDetail: r.reason_detail,
  method: r.method,
  accountProvider: r.account_provider ?? "",
  accountNumberMasked: mask(r.account_number),
  accountOwner: r.account_owner ?? "",
  rejectReason: r.reject_reason,
  filedAt: r.filed_at.toISOString(),
  decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
});

/** >48 jam sebelum kunjungan = 100%, 24-48 jam = 75%, <24 jam = 0%. */
export function percentFor(visitAt: Date, now: Date = new Date()): number {
  const mins = Math.floor((visitAt.getTime() - now.getTime()) / 60000);

  if (mins > 48 * 60) return 100;
  if (mins >= 24 * 60) return 75;
  return 0;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// WIB = UTC+7
function visitText(d: Date, tickets: number): string {
  const w = new Date(d.getTime() + 7 * 3600 * 1000);
  const hh = String(w.getUTCHours()).padStart(2, "0");
  const mm = String(w.getUTCMinutes()).padStart(2, "0");

  return `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]} ${w.getUTCFullYear()} · ${hh}.${mm} WIB · ${tickets} tiket`;
}

function refundCode(orderId: string, now: Date): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const clean = orderId.replace(/[^A-Za-z0-9]/g, "");
  const tail = clean.length > 4 ? clean.slice(-4) : clean;

  return `RF-${yy}${mo}${dd}-${tail.toUpperCase()}`;
}

export async function create(
  userId: string,
  userEmail: string,
  input: CreateRefundInput,
): Promise<CreateResult> {
  // Normalisasi supaya tidak gagal hanya karena whitespace.
  const cleanUserId = String(userId).trim();
  const cleanOrderId = String(input.orderId).trim();

  // Gunakan POOL yang sama dengan proses INSERT refund.
  // Jadi pencarian payment dan penyimpanan refund benar-benar
  // menggunakan koneksi database yang sama.
  const [paymentRows] = await pool.execute<PaymentRow[]>(
    `SELECT
       id,
       order_id,
       user_id,
       item_name,
       amount,
       status,
       customer_name,
       customer_email
     FROM payments
     WHERE TRIM(user_id) = ?
       AND TRIM(order_id) = ?
     LIMIT 1`,
    [cleanUserId, cleanOrderId],
  );

  const payment = paymentRows[0];

  if (!payment) {
    return { ok: false, error: "not_found" };
  }

  if (payment.status !== "paid") {
    return { ok: false, error: "not_paid" };
  }

  const [dup] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM refunds WHERE order_id = ? LIMIT 1",
    [cleanOrderId],
  );

  if (dup.length > 0) {
    return { ok: false, error: "duplicate" };
  }

  // Persentase dihitung ulang berdasarkan waktu SERVER saat pengajuan.
  const now = new Date();
  const visitAt = new Date(input.visitAt);

  if (Number.isNaN(visitAt.getTime())) {
    return { ok: false, error: "not_allowed" };
  }

  const percent = percentFor(visitAt, now);

  if (percent === 0) {
    return { ok: false, error: "not_allowed" };
  }

  const amount = Math.round((payment.amount * percent) / 100);

  const id = randomUUID();
  const method =
    input.methodType === "bank" ? "Transfer Bank" : "Dompet Digital";

  try {
    await pool.execute(
      `INSERT INTO refunds
        (id, user_id, code, requester, participants, destination, trx_code, visit_info,
         filed_at, proof_at, amount, reason, reason_detail, method, status,
         reject_reason, admin_note, decided_at,
         order_id, visit_at, percent, account_provider, account_number, account_owner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cleanUserId,
        refundCode(cleanOrderId, now),
        payment.customer_name || userEmail || "Pengunjung",
        `${input.tickets} Peserta`,
        "Kampung Budaya Polowijen",
        cleanOrderId.slice(0, 40),
        visitText(visitAt, input.tickets),
        now,
        now,
        amount,
        input.reason,
        input.note,
        method,
        "Menunggu",
        "",
        "",
        null,
        cleanOrderId,
        visitAt,
        percent,
        input.provider,
        input.accountNumber,
        input.accountOwner,
      ],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") {
      return { ok: false, error: "duplicate" };
    }

    throw e;
  }

  const [rows] = await pool.execute<Row[]>(
    "SELECT * FROM refunds WHERE id = ?",
    [id],
  );

  return {
    ok: true,
    refund: toDTO(rows[0]),
  };
}

export async function listMine(userId: string): Promise<AppRefundDTO[]> {
  const [rows] = await pool.execute<Row[]>(
    "SELECT * FROM refunds WHERE user_id = ? AND order_id IS NOT NULL ORDER BY filed_at DESC",
    [userId],
  );

  return rows.map(toDTO);
}

export async function findByOrder(
  userId: string,
  orderId: string,
): Promise<AppRefundDTO | null> {
  const [rows] = await pool.execute<Row[]>(
    "SELECT * FROM refunds WHERE user_id = ? AND order_id = ? LIMIT 1",
    [String(userId).trim(), String(orderId).trim()],
  );

  return rows[0] ? toDTO(rows[0]) : null;
}
