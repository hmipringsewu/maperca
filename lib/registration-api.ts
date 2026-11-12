import { supabaseKey, supabaseUrl } from "./supabase-config";

export type RegistrationResult = { id: string; followConfirmed: boolean; tiktokConfirmed: boolean };
export type FollowPlatform = "instagram" | "tiktok";

type RpcError = { code?: string; message?: string };

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Pendaftaran belum dibuka. Silakan hubungi panitia MAPERCA.");
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(args),
    });
  } catch {
    throw new Error("Koneksi terputus. Periksa internetmu lalu coba lagi.");
  }

  const data = (await response.json().catch(() => null)) as (T & RpcError) | null;
  if (!response.ok || !data) {
    // P0001 is what our own `raise exception` produces, written for participants.
    // Any other code is a database internal and must not reach the page.
    throw new Error(data?.code === "P0001" && data.message ? data.message : fallback);
  }
  return data;
}

export function submitRegistration(values: Record<string, string>, requestId: string) {
  return rpc<RegistrationResult>(
    "maperca_daftar",
    {
      p_request_id: requestId,
      p_nama: values.nama,
      p_kampus: values.kampus,
      p_hp: values.hp,
      p_alamat: values.alamat,
      p_jurusan: values.jurusan,
      p_tempat_lahir: values.tempatLahir,
      p_tanggal_lahir: values.tanggalLahir,
      p_tanggal_kuliah: values.tanggalKuliah,
      p_consent: true,
    },
    "Pendaftaran belum tersimpan. Silakan coba lagi beberapa saat lagi.",
  );
}

export function markFollowOpened(id: string, requestId: string, platform: FollowPlatform) {
  return rpc<{ opened: boolean }>(
    "maperca_follow",
    { p_id: id, p_request_id: requestId, p_action: "open", p_platform: platform },
    "Konfirmasi belum tersimpan. Silakan coba lagi.",
  );
}

export function confirmFollow(id: string, requestId: string) {
  return rpc<{ followConfirmed: boolean; tiktokConfirmed: boolean }>(
    "maperca_follow",
    { p_id: id, p_request_id: requestId, p_action: "confirm" },
    "Konfirmasi belum tersimpan. Silakan coba lagi.",
  );
}
