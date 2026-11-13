import { useState, type FormEvent } from "react";
import { signIn, type Session } from "../../lib/admin-api";

type Props = { notice: string; onSignedIn: (session: Session) => void | Promise<void> };

// Sign-in only. Accounts are not created from this page: the project refuses
// every account except the allowlisted admin emails (see supabase/migrations).
export function LoginCard({ notice, onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSignedIn(await signIn(email.trim(), password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" aria-labelledby="admin-login-title">
      <p className="section-label">ADMIN HMI PRINGSEWU</p>
      <h1 id="admin-login-title">Masuk admin</h1>
      <p className="admin-muted">Halaman ini khusus admin untuk melihat dan mengelola data pendaftar.</p>
      {notice && <p className="admin-info" role="status">{notice}</p>}
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@email.com"
          />
        </label>
        <label>
          <span>Kata sandi</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button admin-submit" type="submit" disabled={busy}>
          {busy ? "Memproses…" : "Masuk"}
        </button>
      </form>
    </section>
  );
}
