import { useMemo, useState } from "react";
import { Check, Download, Search } from "lucide-react";
import type { Registrant } from "../../lib/admin-api";
import { toCsv } from "../../lib/csv";

const jakarta = { timeZone: "Asia/Jakarta" } as const;
const dateFormat = new Intl.DateTimeFormat("id-ID", { ...jakarta, day: "numeric", month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("id-ID", { ...jakarta, hour: "2-digit", minute: "2-digit", hour12: false });
// Birth and enrolment dates carry no time zone, so they are formatted as the calendar day they name.
const plainDateFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const numberFormat = new Intl.NumberFormat("id-ID");

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return `${dateFormat.format(date)} | ${timeFormat.format(date)} WIB`;
}

function formatDate(ymd: string) {
  return plainDateFormat.format(new Date(`${ymd}T00:00:00Z`));
}

const followDone = (row: Registrant) => !!row.instagram_confirmed_at && !!row.tiktok_confirmed_at;

const csvHeader = [
  "Nomor bukti", "Waktu daftar", "Nama", "HP", "Kampus", "Jurusan",
  "Tempat lahir", "Tanggal lahir", "Masuk kuliah", "Alamat", "Follow Instagram", "Follow TikTok",
];

function downloadCsv(rows: Registrant[]) {
  const csv = toCsv(csvHeader, rows.map((row) => [
    row.id, formatDateTime(row.consent_at), row.nama, row.hp, row.kampus, row.jurusan,
    row.tempat_lahir, formatDate(row.tanggal_lahir), formatDate(row.tanggal_kuliah), row.alamat,
    row.instagram_confirmed_at ? "Sudah" : "Belum", row.tiktok_confirmed_at ? "Sudah" : "Belum",
  ]));
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pendaftar-maperca-${new Date().toLocaleDateString("en-CA", jakarta)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function RegistrantTable({ rows }: { rows: Registrant[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => needle
      ? rows.filter((row) => [row.nama, row.hp, row.kampus, row.jurusan, row.id, row.alamat]
          .some((value) => value.toLowerCase().includes(needle)))
      : rows,
    [rows, needle],
  );
  const done = rows.filter(followDone).length;

  return (
    <>
      <dl className="admin-stats">
        <div><dt>Total pendaftar</dt><dd>{numberFormat.format(rows.length)}</dd></div>
        <div><dt>Selesai follow</dt><dd>{numberFormat.format(done)}</dd></div>
        <div><dt>Belum follow</dt><dd>{numberFormat.format(rows.length - done)}</dd></div>
      </dl>

      <div className="admin-toolbar">
        <label className="admin-search">
          <span className="sr-only">Cari pendaftar</span>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, HP, kampus, jurusan, atau nomor bukti"
          />
        </label>
        <button className="button admin-download" type="button" onClick={() => downloadCsv(visible)} disabled={visible.length === 0}>
          <Download size={16} aria-hidden="true" /> Unduh CSV{needle ? ` (${numberFormat.format(visible.length)})` : ""}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="admin-empty">Belum ada pendaftar. Data akan muncul di sini setelah formulir pertama masuk.</p>
      ) : visible.length === 0 ? (
        <p className="admin-empty">Tidak ada pendaftar yang cocok dengan “{query.trim()}”. Coba kata kunci lain.</p>
      ) : (
        <div className="admin-table-wrap" role="region" aria-label="Tabel pendaftar" tabIndex={0}>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">No</th>
                <th scope="col">Waktu daftar</th>
                <th scope="col">Nama</th>
                <th scope="col">HP</th>
                <th scope="col">Kampus / Jurusan</th>
                <th scope="col">Lahir</th>
                <th scope="col">Masuk kuliah</th>
                <th scope="col">Alamat</th>
                <th scope="col">Follow</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{formatDateTime(row.consent_at)}<small>{row.id}</small></td>
                  <th scope="row">{row.nama}</th>
                  <td>{row.hp}</td>
                  <td>{row.kampus}<small>{row.jurusan}</small></td>
                  <td>{row.tempat_lahir}<small>{formatDate(row.tanggal_lahir)}</small></td>
                  <td>{formatDate(row.tanggal_kuliah)}</td>
                  <td className="admin-address">{row.alamat}</td>
                  <td>
                    {followDone(row)
                      ? <span className="admin-badge done"><Check size={13} aria-hidden="true" /> Selesai</span>
                      : <span className="admin-badge">Belum</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
