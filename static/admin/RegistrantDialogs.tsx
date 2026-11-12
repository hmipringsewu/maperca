import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Registrant, RegistrantEdit } from "../../lib/admin-api";

type DialogProps = { labelledBy: string; busy: boolean; onClose: () => void; children: ReactNode };

// A native modal <dialog> gives focus trapping, Escape and a backdrop for free.
function Modal({ labelledBy, busy, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby={labelledBy}
      onClose={onClose}
      // Closing mid-request would hide whether the change went through.
      onCancel={(event) => { if (busy) event.preventDefault(); }}
    >
      {children}
    </dialog>
  );
}

const textFields: { name: Exclude<keyof RegistrantEdit, "alamat">; label: string; type?: "tel" | "date" }[] = [
  { name: "nama", label: "Nama lengkap" },
  { name: "hp", label: "Nomor HP / WhatsApp", type: "tel" },
  { name: "kampus", label: "Asal kampus" },
  { name: "jurusan", label: "Jurusan / program studi" },
  { name: "tempat_lahir", label: "Tempat lahir" },
  { name: "tanggal_lahir", label: "Tanggal lahir", type: "date" },
  { name: "tanggal_kuliah", label: "Tanggal masuk kuliah", type: "date" },
];

type EditProps = { row: Registrant; onClose: () => void; onSave: (values: RegistrantEdit) => Promise<void> };

export function EditDialog({ row, onClose, onSave }: EditProps) {
  const [values, setValues] = useState<RegistrantEdit>({
    nama: row.nama, hp: row.hp, kampus: row.kampus, jurusan: row.jurusan, tempat_lahir: row.tempat_lahir,
    tanggal_lahir: row.tanggal_lahir, tanggal_kuliah: row.tanggal_kuliah, alamat: row.alamat,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Perubahan belum tersimpan. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy="admin-edit-title" busy={busy} onClose={onClose}>
      <form className="admin-form admin-dialog-body" onSubmit={submit}>
        <div>
          <h2 id="admin-edit-title">Ubah data pendaftar</h2>
          <p className="admin-muted">Nomor bukti {row.id}</p>
        </div>
        <div className="admin-dialog-grid">
          {textFields.map((field) => {
            const isDate = field.type === "date";
            const isTel = field.type === "tel";
            return (
              <label key={field.name}>
                <span>{field.label}</span>
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  required
                  minLength={isDate || isTel ? undefined : 2}
                  maxLength={isDate ? undefined : isTel ? 20 : 150}
                  min={isDate ? "1900-01-01" : undefined}
                  max={isDate ? today : undefined}
                  pattern={isTel ? "(08|628|\\+628)[0-9 \\-]{7,15}" : undefined}
                  title={isTel ? "Gunakan nomor Indonesia: 08…, 628…, atau +628…" : undefined}
                  autoComplete="off"
                  value={values[field.name]}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              </label>
            );
          })}
          <label className="full">
            <span>Alamat domisili</span>
            <textarea
              name="alamat"
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={values.alamat}
              onChange={(event) => setValues((current) => ({ ...current, alamat: event.target.value }))}
            />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="admin-dialog-actions">
          <button type="button" className="admin-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" className="button admin-download" disabled={busy}>{busy ? "Menyimpan…" : "Simpan perubahan"}</button>
        </div>
      </form>
    </Modal>
  );
}

type DeleteProps = { row: Registrant; onClose: () => void; onDelete: () => Promise<void> };

export function DeleteDialog({ row, onClose, onDelete }: DeleteProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onDelete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pendaftar belum terhapus. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy="admin-delete-title" busy={busy} onClose={onClose}>
      <div className="admin-dialog-body">
        <div>
          <h2 id="admin-delete-title">Hapus pendaftar ini?</h2>
          <p className="admin-muted">
            <strong>{row.nama}</strong> ({row.id}) akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan.
          </p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="admin-dialog-actions">
          {/* Cancel comes first so it, not the destructive action, takes initial focus. */}
          <button type="button" className="admin-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button type="button" className="admin-danger" onClick={() => void confirm()} disabled={busy}>
            {busy ? "Menghapus…" : "Ya, hapus"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
