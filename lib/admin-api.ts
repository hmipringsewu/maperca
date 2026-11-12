import { supabaseKey, supabaseUrl } from "./supabase-config";

export type Session = { accessToken: string; email: string };

export type Registrant = {
  id: string;
  nama: string;
  hp: string;
  kampus: string;
  jurusan: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  tanggal_kuliah: string;
  alamat: string;
  consent_at: string;
  instagram_confirmed_at: string | null;
  tiktok_confirmed_at: string | null;
};

export class SessionExpiredError extends Error {
  constructor() {
    super("Sesi berakhir. Silakan masuk lagi.");
  }
}

type AuthBody = {
  access_token?: string;
  user?: { email?: string };
  error_code?: string;
  code?: string | number;
  message?: string;
};

const authMessages: Record<string, string> = {
  invalid_credentials: "Email atau kata sandi salah.",
  email_not_confirmed: "Email belum dikonfirmasi. Buka tautan di email konfirmasi, lalu masuk lagi.",
  user_already_exists: "Email ini sudah punya akun. Silakan masuk.",
  weak_password: "Kata sandi terlalu lemah. Pakai minimal 8 karakter.",
  over_email_send_rate_limit: "Terlalu banyak email konfirmasi dikirim. Coba lagi sekitar satu jam lagi.",
  over_request_rate_limit: "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
  signup_disabled: "Pembuatan akun sedang ditutup. Hubungi pengelola.",
  email_address_invalid: "Alamat email tidak valid.",
};

async function request(path: string, init: RequestInit, token?: string) {
  try {
    return await fetch(`${supabaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${token ?? supabaseKey}`,
      },
    });
  } catch {
    throw new Error("Koneksi terputus. Periksa internetmu lalu coba lagi.");
  }
}

async function auth(path: string, email: string, password: string, fallback: string) {
  const response = await request(path, { method: "POST", body: JSON.stringify({ email, password }) });
  const data = (await response.json().catch(() => null)) as AuthBody | null;
  if (!response.ok || !data) {
    throw new Error(authMessages[data?.error_code ?? ""] ?? fallback);
  }
  return data;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const data = await auth("/auth/v1/token?grant_type=password", email, password, "Belum bisa masuk. Coba lagi.");
  if (!data.access_token) throw new Error("Belum bisa masuk. Coba lagi.");
  return { accessToken: data.access_token, email: data.user?.email ?? email };
}

/** Returns a session when the project confirms emails automatically, otherwise null. */
export async function signUp(email: string, password: string, returnTo: string): Promise<Session | null> {
  const path = `/auth/v1/signup?redirect_to=${encodeURIComponent(returnTo)}`;
  const data = await auth(path, email, password, "Akun belum bisa dibuat. Coba lagi.");
  return data.access_token ? { accessToken: data.access_token, email } : null;
}

export async function signOut(session: Session) {
  // Best effort: the token only lives in memory, so dropping it already signs the browser out.
  await request("/auth/v1/logout", { method: "POST" }, session.accessToken).catch(() => undefined);
}

async function adminRpc<T>(session: Session, name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const response = await request(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }, session.accessToken);
  if (response.status === 401) throw new SessionExpiredError();
  const data = (await response.json().catch(() => null)) as (T & { code?: string; message?: string }) | null;
  if (!response.ok || data === null) {
    // P0001 is our own `raise exception`; other codes are database internals.
    throw new Error(data?.code === "P0001" && data.message ? data.message : fallback);
  }
  return data;
}

export function listRegistrants(session: Session) {
  return adminRpc<Registrant[]>(session, "maperca_admin_list", {}, "Data pendaftar belum bisa dimuat. Coba lagi.");
}

/** The fields an admin may correct. Receipt number, timestamps and follow status stay as recorded. */
export type RegistrantEdit = Pick<
  Registrant,
  "nama" | "hp" | "kampus" | "jurusan" | "tempat_lahir" | "tanggal_lahir" | "tanggal_kuliah" | "alamat"
>;

export function updateRegistrant(session: Session, id: string, values: RegistrantEdit) {
  return adminRpc<Registrant>(
    session,
    "maperca_admin_update",
    {
      p_id: id,
      p_nama: values.nama,
      p_kampus: values.kampus,
      p_hp: values.hp,
      p_alamat: values.alamat,
      p_jurusan: values.jurusan,
      p_tempat_lahir: values.tempat_lahir,
      p_tanggal_lahir: values.tanggal_lahir,
      p_tanggal_kuliah: values.tanggal_kuliah,
    },
    "Perubahan belum tersimpan. Coba lagi.",
  );
}

export async function deleteRegistrant(session: Session, id: string) {
  await adminRpc<{ deleted: boolean }>(session, "maperca_admin_delete", { p_id: id }, "Pendaftar belum terhapus. Coba lagi.");
}
