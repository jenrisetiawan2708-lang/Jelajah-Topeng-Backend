import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";
import { ALL_USERS } from "../validators/record.validator";

export type MyNotificationDTO = {
  id: string;
  title: string;
  message: string;
  recipient: string;
  date: string;
  createdAt: string;
  read: boolean;
  readAt: string | null;
};

export type NotificationStatusDTO = {
  id: string;
  recipient: string;
  readCount: number;
  read: boolean;
};

interface MineRow extends RowDataPacket {
  id: string;
  name: string;
  description: string;
  location: string;
  date_value: string;
  updated_at: Date;
  read_at: Date | null;
}

interface StatusRow extends RowDataPacket {
  id: string;
  location: string;
  read_count: number;
}

// Notifikasi ini ditujukan ke user: "Semua user" atau email user itu sendiri.
const TARGET_SQL = "(r.location = ? OR LOWER(TRIM(r.location)) = ?)";

// Daftar notifikasi milik satu user + status baca PER USER.
export async function listForUser(userId: string, email: string): Promise<MyNotificationDTO[]> {
  const [rows] = await pool.execute<MineRow[]>(
    `SELECT r.id, r.name, r.description, r.location, r.date_value, r.updated_at, nr.read_at
     FROM content_records r
     LEFT JOIN notification_reads nr
       ON nr.notification_id = r.id AND nr.user_id = ?
     WHERE r.kind = 'notification' AND ${TARGET_SQL}
     ORDER BY r.updated_at DESC`,
    [userId, ALL_USERS, email.trim().toLowerCase()],
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.name,
    message: r.description,
    recipient: r.location,
    date: r.date_value,
    createdAt: r.updated_at.toISOString(),
    read: r.read_at !== null,
    readAt: r.read_at ? r.read_at.toISOString() : null,
  }));
}

// Pastikan notifikasi memang ditujukan ke user ini (cegah user menandai notifikasi orang lain).
export async function isRecipient(id: string, email: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id FROM content_records r
     WHERE r.id = ? AND r.kind = 'notification' AND ${TARGET_SQL}`,
    [id, ALL_USERS, email.trim().toLowerCase()],
  );
  return rows.length > 0;
}

// INSERT IGNORE: kalau user yang sama membuka dua kali, tidak error dan tidak dobel.
export async function markRead(notificationId: string, userId: string): Promise<void> {
  await pool.execute<ResultSetHeader>(
    "INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)",
    [notificationId, userId],
  );
}

// Untuk bell admin: status baca tiap notifikasi yang dibuat admin ini.
// Untuk bell admin: notifikasi dianggap terbaca hanya jika
// SELURUH penerima notifikasi sudah membaca lewat aplikasi mobile.
export async function statusForAdmin(
  adminId: string,
): Promise<NotificationStatusDTO[]> {
  const [rows] = await pool.execute<
    (StatusRow & {
      recipient_count: number;
    })[]
  >(
    `SELECT
       r.id,
       r.location,
       COUNT(DISTINCT u.id) AS recipient_count,
       COUNT(DISTINCT nr.user_id) AS read_count
     FROM content_records r
     LEFT JOIN app_users u
       ON u.role = 'user'
       AND (
         LOWER(TRIM(r.location)) = LOWER(TRIM(u.email))
         OR LOWER(TRIM(r.location)) = LOWER(TRIM(?))
       )
     LEFT JOIN notification_reads nr
       ON nr.notification_id = r.id
       AND nr.user_id = u.id
     WHERE r.kind = 'notification'
       AND r.user_id = ?
     GROUP BY r.id, r.location
     ORDER BY r.updated_at DESC`,
    [ALL_USERS, adminId],
  );

  return rows.map((r) => {
    const recipientCount = Number(r.recipient_count);
    const readCount = Number(r.read_count);

    return {
      id: r.id,
      recipient: r.location,
      readCount,
      read: recipientCount > 0 && readCount >= recipientCount,
    };
  });
}
