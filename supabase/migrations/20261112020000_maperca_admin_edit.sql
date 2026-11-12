-- Admin edit and delete, with an audit trail.
--
-- Field validation moves into one helper so the public form and the admin edit
-- can never disagree about what a valid registration is. The admin check moves
-- into one helper for the same reason.

create function maperca.clean_registration(
  p_nama text, p_kampus text, p_hp text, p_alamat text, p_jurusan text, p_tempat_lahir text,
  p_tanggal_lahir date, p_tanggal_kuliah date,
  out nama text, out kampus text, out hp text, out alamat text, out jurusan text, out tempat_lahir text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  nama := btrim(coalesce(p_nama, ''));
  kampus := btrim(coalesce(p_kampus, ''));
  jurusan := btrim(coalesce(p_jurusan, ''));
  tempat_lahir := btrim(coalesce(p_tempat_lahir, ''));
  alamat := btrim(coalesce(p_alamat, ''));
  hp := regexp_replace(coalesce(p_hp, ''), '[\s-]', '', 'g');

  if char_length(nama) not between 2 and 150 then
    raise exception 'Nama lengkap harus 2 sampai 150 karakter.';
  end if;
  if char_length(coalesce(p_hp, '')) > 20 or hp !~ '^(08|628|\+628)[0-9]{7,12}$' then
    raise exception 'Nomor HP tidak valid. Gunakan nomor Indonesia: 08…, 628…, atau +628….';
  end if;
  if char_length(kampus) not between 2 and 150 then
    raise exception 'Asal kampus harus 2 sampai 150 karakter.';
  end if;
  if char_length(jurusan) not between 2 and 150 then
    raise exception 'Jurusan harus 2 sampai 150 karakter.';
  end if;
  if char_length(tempat_lahir) not between 2 and 150 then
    raise exception 'Tempat lahir harus 2 sampai 150 karakter.';
  end if;
  if char_length(alamat) not between 10 and 500 then
    raise exception 'Alamat domisili harus 10 sampai 500 karakter.';
  end if;
  if p_tanggal_lahir is null or p_tanggal_lahir < date '1900-01-01' or p_tanggal_lahir > v_today then
    raise exception 'Tanggal lahir tidak valid atau berada di masa depan.';
  end if;
  if p_tanggal_kuliah is null or p_tanggal_kuliah > v_today then
    raise exception 'Tanggal masuk kuliah tidak valid atau berada di masa depan.';
  end if;
  if p_tanggal_kuliah <= p_tanggal_lahir then
    raise exception 'Tanggal masuk kuliah harus setelah tanggal lahir.';
  end if;
end;
$$;

-- Returns the caller's email when they are an allowlisted admin, raises otherwise.
create function maperca.current_admin_email()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text;
begin
  -- An unconfirmed address proves nothing about who typed it.
  select lower(u.email) into v_email
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;

  if v_email is null
     or not exists (select 1 from maperca.admins a where lower(a.email) = v_email) then
    raise exception 'Akun ini belum diberi akses admin. Minta pengelola menambahkan emailmu.';
  end if;
  return v_email;
end;
$$;

revoke execute on function maperca.clean_registration(text, text, text, text, text, text, date, date) from public;
revoke execute on function maperca.current_admin_email() from public;

-- Who changed or removed which registration, and what it looked like before.
create table maperca.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_email text not null,
  action text not null check (action in ('update', 'delete')),
  registration_id text not null,
  before jsonb not null,
  after jsonb
);
alter table maperca.audit_log enable row level security;
revoke all on maperca.audit_log from anon, authenticated;

create or replace function public.maperca_daftar(
  p_request_id uuid,
  p_nama text,
  p_kampus text,
  p_hp text,
  p_alamat text,
  p_jurusan text,
  p_tempat_lahir text,
  p_tanggal_lahir date,
  p_tanggal_kuliah date,
  p_consent boolean
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean record;
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip_hash text;
  v_row maperca.registrations;
begin
  if p_request_id is null then
    raise exception 'Formulir belum lengkap. Muat ulang halaman lalu coba lagi.';
  end if;
  if p_consent is not true then
    raise exception 'Centang pernyataan persetujuan terlebih dahulu.';
  end if;
  select * into v_clean from maperca.clean_registration(
    p_nama, p_kampus, p_hp, p_alamat, p_jurusan, p_tempat_lahir, p_tanggal_lahir, p_tanggal_kuliah
  );

  -- A retried submit carries the same request id and must return the same receipt.
  select * into v_row from maperca.registrations where request_id = p_request_id;

  if not found then
    v_ip_hash := encode(sha256(convert_to(coalesce(
      nullif(v_headers ->> 'cf-connecting-ip', ''),
      nullif(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
      'unknown'
    ), 'UTF8')), 'hex');

    delete from maperca.registration_hits where hit_at < now() - interval '1 day';
    -- Generous on purpose: a whole campus can sit behind one address.
    if (select count(*) from maperca.registration_hits
        where ip_hash = v_ip_hash and hit_at > now() - interval '1 hour') >= 30 then
      raise exception 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi sekitar satu jam lagi.';
    end if;

    insert into maperca.registrations (
      id, request_id, nama, kampus, hp, alamat, jurusan, tempat_lahir, tanggal_lahir, tanggal_kuliah
    ) values (
      'MPR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
      p_request_id, v_clean.nama, v_clean.kampus, v_clean.hp, v_clean.alamat, v_clean.jurusan,
      v_clean.tempat_lahir, p_tanggal_lahir, p_tanggal_kuliah
    )
    on conflict (request_id) do nothing;

    if found then
      insert into maperca.registration_hits (ip_hash) values (v_ip_hash);
    end if;

    select * into v_row from maperca.registrations where request_id = p_request_id;
  end if;

  return json_build_object(
    'id', v_row.id,
    'followConfirmed', v_row.instagram_confirmed_at is not null and v_row.tiktok_confirmed_at is not null,
    'tiktokConfirmed', v_row.tiktok_confirmed_at is not null
  );
end;
$$;

create or replace function public.maperca_admin_list()
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform maperca.current_admin_email();

  return coalesce((
    select json_agg(r order by r.consent_at desc)
    from (
      select id, nama, hp, kampus, jurusan, tempat_lahir, tanggal_lahir, tanggal_kuliah,
             alamat, consent_at, instagram_confirmed_at, tiktok_confirmed_at
      from maperca.registrations
    ) r
  ), '[]'::json);
end;
$$;

create function public.maperca_admin_update(
  p_id text,
  p_nama text,
  p_kampus text,
  p_hp text,
  p_alamat text,
  p_jurusan text,
  p_tempat_lahir text,
  p_tanggal_lahir date,
  p_tanggal_kuliah date
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := maperca.current_admin_email();
  v_clean record;
  v_before maperca.registrations;
  v_after maperca.registrations;
begin
  select * into v_before from maperca.registrations where id = p_id for update;
  if not found then
    raise exception 'Pendaftar tidak ditemukan. Muat ulang daftar lalu coba lagi.';
  end if;

  select * into v_clean from maperca.clean_registration(
    p_nama, p_kampus, p_hp, p_alamat, p_jurusan, p_tempat_lahir, p_tanggal_lahir, p_tanggal_kuliah
  );

  update maperca.registrations
  set nama = v_clean.nama, kampus = v_clean.kampus, hp = v_clean.hp, alamat = v_clean.alamat,
      jurusan = v_clean.jurusan, tempat_lahir = v_clean.tempat_lahir,
      tanggal_lahir = p_tanggal_lahir, tanggal_kuliah = p_tanggal_kuliah
  where id = p_id
  returning * into v_after;

  if to_jsonb(v_before) is distinct from to_jsonb(v_after) then
    insert into maperca.audit_log (admin_email, action, registration_id, before, after)
    values (v_admin, 'update', p_id, to_jsonb(v_before), to_jsonb(v_after));
  end if;

  return json_build_object(
    'id', v_after.id, 'nama', v_after.nama, 'hp', v_after.hp, 'kampus', v_after.kampus,
    'jurusan', v_after.jurusan, 'tempat_lahir', v_after.tempat_lahir,
    'tanggal_lahir', v_after.tanggal_lahir, 'tanggal_kuliah', v_after.tanggal_kuliah,
    'alamat', v_after.alamat, 'consent_at', v_after.consent_at,
    'instagram_confirmed_at', v_after.instagram_confirmed_at,
    'tiktok_confirmed_at', v_after.tiktok_confirmed_at
  );
end;
$$;

create function public.maperca_admin_delete(p_id text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := maperca.current_admin_email();
  v_before maperca.registrations;
begin
  delete from maperca.registrations where id = p_id returning * into v_before;
  if not found then
    raise exception 'Pendaftar tidak ditemukan. Muat ulang daftar lalu coba lagi.';
  end if;

  insert into maperca.audit_log (admin_email, action, registration_id, before)
  values (v_admin, 'delete', p_id, to_jsonb(v_before));

  return json_build_object('deleted', true);
end;
$$;

revoke execute on function public.maperca_admin_update(text, text, text, text, text, text, text, date, date) from public, anon;
revoke execute on function public.maperca_admin_delete(text) from public, anon;
grant execute on function public.maperca_admin_update(text, text, text, text, text, text, text, date, date) to authenticated;
grant execute on function public.maperca_admin_delete(text) to authenticated;
