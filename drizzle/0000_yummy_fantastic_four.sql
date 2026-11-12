CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`nama` text NOT NULL,
	`kampus` text NOT NULL,
	`hp` text NOT NULL,
	`alamat` text NOT NULL,
	`jurusan` text NOT NULL,
	`tempat_lahir` text NOT NULL,
	`tanggal_lahir` text NOT NULL,
	`tanggal_kuliah` text NOT NULL,
	`consent_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_request_id_unique` ON `registrations` (`request_id`);