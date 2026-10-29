import type { RequestHandler } from "express";
import { z } from "zod";
import { CONTENT_PROFILES, KINDS, type RecordKind } from "../content/profiles";
import { fieldErrorsFromIssues } from "./validate";

export type FieldKey =
  | "name"
  | "description"
  | "location"
  | "date"
  | "amount"
  | "status"
  | "correctAnswer"
  | "correctClue"
  | "imageUrl"
  | "eventDate";

type Values = Partial<Record<FieldKey, string>>;

const LETTERS_ONLY = /^[\p{L}\s.,'’-]+$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/.+/i;
const MAX_IMAGE_URL_LENGTH = 500;

// Tanggal hari ini (WIB) format YYYY-MM-DD, dengan geser hari opsional.
function todayWib(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Kalender: hanya hari ini sampai 7 hari ke depan, tidak boleh ke belakang.
function validateNextWeek(value: string): string {
  if (!value) return "";
  if (!isRealDate(value)) return "Tanggal tidak valid";
  if (value < todayWib(0)) return "Tanggal tidak boleh sebelum hari ini";
  if (value > todayWib(7)) return "Tanggal maksimal 7 hari dari hari ini";
  return "";
}

function validateByLabel(label: string, raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const l = label.toLowerCase();

  if (
    l.startsWith("nama") ||
    ["maestro", "wilayah", "kategori", "penerima"].includes(l)
  ) {
    if (/\d/.test(value)) return `${label} tidak boleh mengandung angka`;
    if (!LETTERS_ONLY.test(value)) return `${label} hanya boleh berisi huruf`;
  }
  if (l === "durasi" || l === "jumlah subbab") {
    if (!/^\d+(\s*[a-z]+)?$/i.test(value)) {
      return `${label} harus berupa angka (contoh: 90 menit)`;
    }
  }
  if (l === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Format email tidak valid";
  }
  if ((l === "harga" || l === "jumlah") && !/\d/.test(value)) {
    return `${label} harus berisi angka`;
  }
  return "";
}

// Aturan validasi per halaman, dijaga di API.
export function checkRecord(
  kind: RecordKind,
  v: Values,
): Partial<Record<FieldKey, string>> {
  const profile = CONTENT_PROFILES[kind];
  const f = profile.fields;
  const get = (key: FieldKey) => (v[key] ?? "").trim();
  const errors: Partial<Record<FieldKey, string>> = {};

  const name = get("name");
  if (!name) errors.name = `${f[0]} wajib diisi`;
  else if (name.length < 3) errors.name = `${f[0]} minimal 3 karakter`;
  else if (name.length > 120) errors.name = `${f[0]} maksimal 120 karakter`;
  else if (kind !== "panji") {
    const message = validateByLabel(f[0], name);
    if (message) errors.name = message;
  }

  if (!profile.statuses.includes(get("status"))) {
    errors.status = "Status tidak valid";
  }

  if (get("description").length > 1000) {
    errors.description = "Maksimal 1000 karakter";
  }

  if (kind === "panji") {
    if (!get("description")) errors.description = `${f[1]} wajib diisi`;

    const answer = get("correctAnswer");
    if (!answer) errors.correctAnswer = "Jawaban yang benar wajib diisi";
    else if (answer.length > 200) errors.correctAnswer = "Jawaban maksimal 200 karakter";

    const clue = get("correctClue");
    if (!clue) errors.correctClue = "Clue wajib diisi";
    else if (clue.length > 1000) errors.correctClue = "Clue maksimal 1000 karakter";

    const image = get("imageUrl");
    if (!image) errors.imageUrl = "Gambar wajib diunggah";
    else if (!BLOB_URL_RE.test(image)) errors.imageUrl = "URL gambar tidak valid";
    else if (image.length > MAX_IMAGE_URL_LENGTH) errors.imageUrl = "URL gambar terlalu panjang";
    return errors;
  }

  const location = get("location");
  if (location.length > 200) errors.location = `${f[2]} maksimal 200 karakter`;
  else {
    const message = validateByLabel(f[2], location);
    if (message) errors.location = message;
  }

  const date = get("date");
  if (f[3] === "Tanggal") {
    // Kalender jadwal: hari ini sampai 7 hari ke depan.
    const message = validateNextWeek(date);
    if (message) errors.date = message;
  } else if (f[3] === "Tahun") {
    // Tahun situs bersejarah: boleh masa lalu, hanya cek format.
    if (date && !isRealDate(date)) errors.date = "Tanggal tidak valid";
  } else {
    const message = validateByLabel(f[3], date);
    if (message) errors.date = message;
  }

  const eventDateError = validateNextWeek(get("eventDate"));
  if (eventDateError) errors.eventDate = eventDateError;

  const amount = get("amount");
  if (amount.length > 1000) errors.amount = `${f[4]} maksimal 1000 karakter`;
  else {
    const message = validateByLabel(f[4], amount);
    if (message) errors.amount = message;
  }

  return errors;
}

const text = z.string().trim().default("");

const recordSchema = z.object({
  kind: z.enum(KINDS),
  name: text,
  description: text,
  location: text,
  date: text,
  amount: text,
  status: text,
  correctAnswer: text,
  correctClue: text,
  imageUrl: text,
  eventDate: text,
});

export type RecordInput = z.infer<typeof recordSchema>;

// Validator middleware: bentuk data (Zod) + aturan per halaman (checkRecord).
export const validateRecord: RequestHandler = (req, res, next) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.fail("Validasi gagal", 400, fieldErrorsFromIssues(parsed.error.issues));
  }

  const errors = checkRecord(parsed.data.kind, parsed.data);
  const entries = Object.entries(errors);
  if (entries.length > 0) {
    const mapped = Object.fromEntries(entries.map(([key, message]) => [key, [message]]));
    return res.fail("Validasi gagal", 400, mapped);
  }

  req.body = parsed.data;
  next();
};