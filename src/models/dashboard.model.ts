import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";
import { listByUser } from "./record.model";

export type DashboardSummary = {
  visits: number;
  verifiedTickets: number;
  activeSessions: number;
  revenue: number;
  transactions: Array<{
    id: string;
    name: string;
    location: string;
    amount: string;
    status: string;
  }>;
  masterclasses: Array<{
    time: string;
    title: string;
    maestro: string;
    place: string;
  }>;
};

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_LABEL: Record<string, string> = {
  paid: "Terverifikasi",
  pending: "Menunggu",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
};

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return "Belum dijadwalkan";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

interface PaymentAgg extends RowDataPacket {
  total: number;
  paid: string | number | null;
  revenue: string | number | null;
}
interface CountRow extends RowDataPacket {
  n: number;
}
interface PaymentRow extends RowDataPacket {
  order_id: string;
  item_name: string;
  amount: number;
  status: string;
  customer_name: string | null;
}
interface BookingRow extends RowDataPacket {
  name: string;
  description: string;
  location: string;
  event_date: string;
  date_value: string;
}

export async function getSummary(userId: string): Promise<DashboardSummary> {
  // Pastikan data contoh (booking, dll.) sudah terisi untuk admin ini.
  await listByUser(userId);

  // Pembayaran dari SEMUA pengunjung (admin memantau semuanya).
  const [aggRows] = await pool.execute<PaymentAgg[]>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS revenue
     FROM payments`,
  );
  const agg = aggRows[0];

  const [sessionRows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS n FROM content_records WHERE user_id = ? AND kind = 'booking' AND status = 'Booking'",
    [userId],
  );

  const [recent] = await pool.execute<PaymentRow[]>(
    `SELECT order_id, item_name, amount, status, customer_name
     FROM payments ORDER BY created_at DESC LIMIT 5`,
  );

  const [bookings] = await pool.execute<BookingRow[]>(
    `SELECT name, description, location, event_date, date_value
     FROM content_records WHERE user_id = ? AND kind = 'booking'
     ORDER BY updated_at DESC LIMIT 5`,
    [userId],
  );

  return {
    visits: Number(agg?.total ?? 0),
    verifiedTickets: Number(agg?.paid ?? 0),
    activeSessions: Number(sessionRows[0]?.n ?? 0),
    revenue: Number(agg?.revenue ?? 0),
    transactions: recent.map((p) => ({
      id: p.order_id,
      name: p.item_name,
      location: p.customer_name || "Pengunjung",
      amount: rupiah(p.amount),
      status: STATUS_LABEL[p.status] ?? p.status,
    })),
    masterclasses: bookings.map((b) => ({
      time: formatDate(b.event_date || b.date_value),
      title: b.name,
      maestro: b.description || "Belum dicantumkan",
      place: b.location || "Belum dicantumkan",
    })),
  };
}