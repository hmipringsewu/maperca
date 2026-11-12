import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import {
  deleteRegistrant, listRegistrants, SessionExpiredError, signOut, updateRegistrant,
  type Registrant, type RegistrantEdit, type Session,
} from "../../lib/admin-api";
import { LoginCard } from "./LoginCard";
import { RegistrantTable } from "./RegistrantTable";

export function AdminPage() {
  // The session lives in memory only: a reload signs the browser out, and no
  // token is left in storage for another script or person on this device.
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Registrant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");

  function expire(message: string) {
    setSession(null);
    setRows(null);
    setStatus("");
    setNotice(message);
  }

  async function load(current: Session) {
    setLoading(true);
    setError("");
    try {
      setRows(await listRegistrants(current));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) expire(caught.message);
      else setError(caught instanceof Error ? caught.message : "Data pendaftar belum bisa dimuat. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // Edits and deletes report their own errors inside the dialog, so they
  // rethrow; an expired session additionally sends the admin back to sign-in.
  async function change<T>(current: Session, task: () => Promise<T>) {
    setStatus("");
    try {
      return await task();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) expire(caught.message);
      throw caught;
    }
  }

  async function handleSave(current: Session, id: string, values: RegistrantEdit) {
    const updated = await change(current, () => updateRegistrant(current, id, values));
    setRows((list) => list && list.map((row) => (row.id === id ? updated : row)));
    setStatus(`Perubahan data ${updated.nama} tersimpan.`);
  }

  async function handleDelete(current: Session, id: string) {
    await change(current, () => deleteRegistrant(current, id));
    setRows((list) => list && list.filter((row) => row.id !== id));
    setStatus("Pendaftar dihapus dari daftar.");
  }

  async function handleSignedIn(next: Session) {
    setSession(next);
    setNotice("");
    await load(next);
  }

  function handleSignOut() {
    if (session) void signOut(session);
    setSession(null);
    setRows(null);
    setError("");
    setStatus("");
  }

  if (!session) {
    return (
      <main className="admin-shell admin-center">
        <LoginCard notice={notice} onSignedIn={handleSignedIn} />
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="section-label">ADMIN HMI PRINGSEWU</p>
          <h1>Data pendaftar</h1>
          <p className="admin-muted">Masuk sebagai {session.email}</p>
        </div>
        <div className="admin-actions">
          <button type="button" className="admin-ghost" onClick={() => void load(session)} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> {loading ? "Memuat…" : "Muat ulang"}
          </button>
          <button type="button" className="admin-ghost" onClick={handleSignOut}>
            <LogOut size={16} aria-hidden="true" /> Keluar
          </button>
        </div>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="admin-info admin-status" role="status">{status}</p>}
      {rows
        ? (
          <RegistrantTable
            rows={rows}
            onSave={(id, values) => handleSave(session, id, values)}
            onDelete={(id) => handleDelete(session, id)}
          />
        )
        : loading && <div className="admin-skeleton" role="status" aria-label="Memuat data pendaftar" />}
    </main>
  );
}
