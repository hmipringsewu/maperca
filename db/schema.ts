import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const registrations = sqliteTable("registrations", {
  id: text("id").primaryKey(), requestId: text("request_id").notNull().unique(),
  nama: text("nama").notNull(), kampus: text("kampus").notNull(), hp: text("hp").notNull(),
  alamat: text("alamat").notNull(), jurusan: text("jurusan").notNull(),
  tempatLahir: text("tempat_lahir").notNull(), tanggalLahir: text("tanggal_lahir").notNull(),
  tanggalKuliah: text("tanggal_kuliah").notNull(), consentAt: text("consent_at").notNull(),
  instagramOpenedAt: text("instagram_opened_at"),
  instagramConfirmedAt: text("instagram_confirmed_at"),
  tiktokOpenedAt: text("tiktok_opened_at"),
  tiktokConfirmedAt: text("tiktok_confirmed_at"),
});
