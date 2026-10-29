import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../config/db";

export type RefundDTO = {
  id: string;
  code: string;
  requester: string;
  participants: string;
  destination: string;
  trxCode: string;
  visitInfo: string;
  filedAt: string;
  proofAt: string;
  amount: number;
  reason: string;
  reasonDetail: string;
  method: string;
  status: string;
  rejectReason: string;
  adminNote: string;
  decidedAt: string | null;
};

interface RefundRow extends RowDataPacket {
  id: string;
  code: string;
  requester: string;
  participants: string;
  destination: string;
  trx_code: string;
  visit_info: string;
  filed_at: Date;
  proof_at: Date;
  amount: number;
  reason: string;
  reason_detail: string;
  method: string;
  status: string;
  reject_reason: string;
  admin_note: string;
  decided_at: Date | null;
}

const toDTO = (r: RefundRow): RefundDTO => ({
  id: r.id,
  code: r.code,
  requester: r.requester,
  participants: r.participants,
  destination: r.destination,
  trxCode: r.trx_code,
  visitInfo: r.visit_info,
  filedAt: r.filed_at.toISOString(),
  proofAt: r.proof_at.toISOString(),
  amount: r.amount,
  reason: r.reason,
  reasonDetail: r.reason_detail,
  method: r.method,
  status: r.status,
  rejectReason: r.reject_reason,
  adminNote: r.admin_note,
  decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
});

// WIB = UTC+7
const wib = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

const SEEDS = [
  {
    code: "RF-2024-889",
    requester: "SMA Taruna Nusantara",
    participants: "24 Peserta Edukasi Workshop",
    destination: "Kampung Topeng Malangan",
    trxCode: "TRX-2024-889",
    visitInfo: "25 Oktober 2024 · 09.00 WIB · 24 tiket",
    filedAt: wib("2024-10-24", "10:14"),
    proofAt: wib("2024-10-24", "10:18"),
    amount: 3_600_000,
    reason: "Pembatalan jadwal",
    reasonDetail:
      "Jadwal kunjungan berubah. Rombongan tidak dapat hadir pada tanggal yang telah dipesan.",
    method: "QRIS Dinamis",
    status: "Menunggu",
  },
  {
    code: "RF-2024-890",
    requester: "Dr. Helena Meyer",
    participants: "1 Peserta Perorangan",
    destination: "Sanggar Cirebon Slangit",
    trxCode: "TRX-2024-890",
    visitInfo: "26 Oktober 2024 · 10.00 WIB · 1 tiket",
    filedAt: wib("2024-10-23", "09:30"),
    proofAt: wib("2024-10-23", "09:34"),
    amount: 850_000,
    reason: "Kesalahan pembelian",
    reasonDetail: "Tiket terbeli dua kali pada transaksi yang sama.",
    method: "Transfer Bank",
    status: "Disetujui",
  },
  {
    code: "RF-2024-882",
    requester: "Komunitas Tari Sekar",
    participants: "12 Peserta Komunitas",
    destination: "Sentra Topeng Kayu Bobung",
    trxCode: "TRX-2024-882",
    visitInfo: "21 Oktober 2024 · 13.00 WIB · 12 tiket",
    filedAt: wib("2024-10-22", "14:05"),
    proofAt: wib("2024-10-22", "14:09"),
    amount: 2_450_000,
    reason: "Pengguna tidak hadir",
    reasonDetail: "Pengajuan dibuat setelah jadwal kunjungan berakhir.",
    method: "QRIS Dinamis",
    status: "Ditolak",
  },
  {
    code: "RF-2024-891",
    requester: "Bpk. Bambang Sutrisno",
    participants: "2 Peserta Perorangan",
    destination: "Padepokan Klaten Panji",
    trxCode: "TRX-2024-891",
    visitInfo: "23 Oktober 2024 · 11.00 WIB · 2 tiket",
    filedAt: wib("2024-10-21", "16:40"),
    proofAt: wib("2024-10-21", "16:43"),
    amount: 600_000,
    reason: "Kesalahan pembelian",
    reasonDetail: "Salah memilih paket kunjungan saat checkout.",
    method: "Virtual Account",
    status: "Disetujui",
  },
  {
    code: "RF-2024-870",
    requester: "Sanggar Tari Rena",
    participants: "8 Peserta Sanggar",
    destination: "Kampung Topeng Malangan",
    trxCode: "TRX-2024-870",
    visitInfo: "27 Oktober 2024 · 09.00 WIB · 8 tiket",
    filedAt: wib("2024-10-20", "08:20"),
    proofAt: wib("2024-10-20", "08:25"),
    amount: 1_200_000,
    reason: "Pembatalan jadwal",
    reasonDetail: "Sanggar menunda kegiatan karena bentrok dengan acara lain.",
    method: "QRIS Dinamis",
    status: "Diproses",
  },
];

async function ensureSeeded(userId: string) {
  const [done] = await pool.execute<RowDataPacket[]>(
    "SELECT kind FROM seeded_kinds WHERE user_id = ? AND kind = 'refund'",
    [userId],
  );
  if (done.length > 0) return;

  await withTransaction(async (conn) => {
    const [mark] = await conn.execute<ResultSetHeader>(
      "INSERT IGNORE INTO seeded_kinds (user_id, kind) VALUES (?, 'refund')",
      [userId],
    );
    if (mark.affectedRows !== 1) return;

    for (const s of SEEDS) {
      const decided = s.status === "Disetujui" || s.status === "Ditolak";
      await conn.execute(
        `INSERT INTO refunds
          (id, user_id, code, requester, participants, destination, trx_code, visit_info,
           filed_at, proof_at, amount, reason, reason_detail, method, status,
           reject_reason, admin_note, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), userId, s.code, s.requester, s.participants, s.destination,
          s.trxCode, s.visitInfo, s.filedAt, s.proofAt, s.amount, s.reason,
          s.reasonDetail, s.method, s.status,
          s.status === "Ditolak"
            ? "Pengajuan refund melewati batas waktu pembatalan, yaitu maksimal 24 jam sebelum jadwal kunjungan."
            : "",
          "",
          decided ? s.filedAt : null,
        ],
      );
    }
  });
}

export async function list(userId: string): Promise<RefundDTO[]> {
  await ensureSeeded(userId);
  const [rows] = await pool.execute<RefundRow[]>(
    "SELECT * FROM refunds WHERE user_id = ? ORDER BY filed_at DESC",
    [userId],
  );
  return rows.map(toDTO);
}

export async function findOwned(userId: string, id: string): Promise<RefundDTO | null> {
  const [rows] = await pool.execute<RefundRow[]>(
    "SELECT * FROM refunds WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  return rows[0] ? toDTO(rows[0]) : null;
}

export type DecideResult = "ok" | "not_found" | "invalid_state";

// TRANSACTION (PPT 7): ubah status refund + catat log harus berhasil BERSAMAAN.
// Kalau salah satu gagal, semuanya di-ROLLBACK.
export async function decide(
  userId: string,
  id: string,
  decision: "approve" | "reject",
  reason: string,
  note: string,
): Promise<DecideResult> {
  return withTransaction(async (conn) => {
    // FOR UPDATE: kunci baris supaya dua admin tidak memutuskan bersamaan
    const [rows] = await conn.execute<RefundRow[]>(
      "SELECT * FROM refunds WHERE id = ? AND user_id = ? FOR UPDATE",
      [id, userId],
    );
    const row = rows[0];
    if (!row) return "not_found" as const;

    const allowedFrom = decision === "approve" ? ["Menunggu", "Diproses"] : ["Menunggu"];
    if (!allowedFrom.includes(row.status)) return "invalid_state" as const;

    const nextStatus = decision === "approve" ? "Disetujui" : "Ditolak";
    const now = new Date();

    await conn.execute(
      `UPDATE refunds
       SET status = ?, reject_reason = ?, admin_note = ?, decided_at = ?
       WHERE id = ? AND user_id = ?`,
      [nextStatus, decision === "reject" ? reason : "", note, now, id, userId],
    );

    await conn.execute(
      `INSERT INTO refund_logs (refund_id, user_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, row.status, nextStatus, (decision === "reject" ? reason : note).slice(0, 500), now],
    );

    return "ok" as const;
  });
}