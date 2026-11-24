import type { RowDataPacket } from "mysql2/promise";
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

export async function list(_userId: string): Promise<RefundDTO[]> {
  // Admin harus melihat seluruh pengajuan refund,
  // bukan hanya refund milik akun admin yang sedang login.
  const [rows] = await pool.execute<RefundRow[]>(
    `SELECT *
     FROM refunds
     WHERE order_id IS NOT NULL
     ORDER BY filed_at DESC`,
  );

  return rows.map(toDTO);
}

export async function findOwned(
  userId: string,
  id: string,
): Promise<RefundDTO | null> {
  const [rows] = await pool.execute<RefundRow[]>(
    `SELECT *
     FROM refunds
     WHERE id = ? AND user_id = ?`,
    [id, userId],
  );

  return rows[0] ? toDTO(rows[0]) : null;
}

export type DecideResult = "ok" | "not_found" | "invalid_state";

// Admin memutuskan refund.
// userId tetap dipakai untuk mencatat siapa admin yang melakukan keputusan,
// tetapi TIDAK digunakan untuk mencari pemilik refund.
export async function decide(
  userId: string,
  id: string,
  decision: "approve" | "reject",
  reason: string,
  note: string,
): Promise<DecideResult> {
  return withTransaction(async (conn) => {
    // Admin harus bisa mengambil refund milik user mana pun.
    // FOR UPDATE mencegah dua admin memproses refund yang sama bersamaan.
    const [rows] = await conn.execute<RefundRow[]>(
      `SELECT *
       FROM refunds
       WHERE id = ?
       FOR UPDATE`,
      [id],
    );

    const row = rows[0];

    if (!row) {
      return "not_found" as const;
    }

    const allowedFrom =
      decision === "approve"
        ? ["Menunggu", "Diproses"]
        : ["Menunggu", "Diproses"];

    if (!allowedFrom.includes(row.status)) {
      return "invalid_state" as const;
    }

    const nextStatus =
      decision === "approve"
        ? "Disetujui"
        : "Ditolak";

    const now = new Date();

    await conn.execute(
      `UPDATE refunds
       SET status = ?,
           reject_reason = ?,
           admin_note = ?,
           decided_at = ?
       WHERE id = ?`,
      [
        nextStatus,
        decision === "reject" ? reason : "",
        note,
        now,
        id,
      ],
    );

    await conn.execute(
      `INSERT INTO refund_logs
        (refund_id, user_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        row.status,
        nextStatus,
        (decision === "reject" ? reason : note).slice(0, 500),
        now,
      ],
    );

    return "ok" as const;
  });
}
