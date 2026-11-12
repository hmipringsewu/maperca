import { useState, type FormEvent } from "react";
import { signIn, signUp, type Session } from "../../lib/admin-api";

type Props = { notice: string; onSignedIn: (session: Session) => void | Promise<void> };

export function LoginCard({ notice, onSignedIn }: Props) {
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const creating = mode === "daftar";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (!creating) {
        await onSignedIn(await signIn(email.trim(), password));
        return;
      }
      const session = await signUp(email.trim(), password, window.location.href.split("#")[0]);
      if (session) {
        await onSignedIn(session);
        return;
      }
      setMode("masuk");
      setPassword("");
      setInfo("Akun dibuat. Buka tautan konfirmasi di emailmu, lalu masuk di sini.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(creating ? "masuk" : "daftar");
    setError("");
    setInfo("");
  }

  return (
    <section className="admin-card" aria-labelledby="admin-login-title">
      <p className="section-label">ADMIN HMI PRINGSEWU</p>
      <h1 id="admin-login-title">{creating ? "Buat akun admin" : "Masuk admin"}</h1>
      <p className="admin-muted">
        {creating
          ? "Pakai email yang sudah didaftarkan pengelola. Akun dengan email lain tidak bisa melihat data."
          : "Halaman ini khusus panitia untuk melihat data pendaftar."}
      </p>
      {notice && <p className="admin-info" role="status">{notice}</p>}
      {info && <p className="admin-info" role="status">{info}</p>}
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
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={creating ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {creating && <small>Minimal 8 karakter.</small>}
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button admin-submit" type="submit" disabled={busy}>
          {busy ? "Memproses…" : creating ? "Buat akun" : "Masuk"}
        </button>
      </form>
      <button type="button" className="admin-link" onClick={switchMode} disabled={busy}>
        {creating ? "Sudah punya akun? Masuk" : "Belum punya akun? Buat akun"}
      </button>
    </section>
  );
}
