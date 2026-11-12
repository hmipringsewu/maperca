import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { listRegistrants, SessionExpiredError, signOut, type Registrant, type Session } from "../../lib/admin-api";
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

  async function load(current: Session) {
    setLoading(true);
    setError("");
    try {
      setRows(await listRegistrants(current));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        setSession(null);
        setRows(null);
        setNotice(caught.message);
      } else {
        setError(caught instanceof Error ? caught.message : "Data pendaftar belum bisa dimuat. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
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
          <p className="section-label">ADMIN MAPERCA</p>
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
      {rows
        ? <RegistrantTable rows={rows} />
        : loading && <div className="admin-skeleton" role="status" aria-label="Memuat data pendaftar" />}
    </main>
  );
}
