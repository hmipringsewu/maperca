-- MAPERCA registrations.
--
-- The tables live in a schema the REST API does not expose, with RLS on and no
-- policies. The public site can only reach them through the two SECURITY
-- DEFINER functions below, which re-validate every field: the browser is not
-- trusted, and the publishable key is visible to anyone.

create schema if not exists maperca;

create table maperca.registrations (
  id text primary key,
  request_id uuid not null unique,
  nama text not null,
  kampus text not null,
  hp text not null,
  alamat text not null,
  jurusan text not null,
  tempat_lahir text not null,
  tanggal_lahir date not null,
  tanggal_kuliah date not null,
  consent_at timestamptz not null default now(),
  instagram_opened_at timestamptz,
  instagram_confirmed_at timestamptz,
  tiktok_opened_at timestamptz,
  tiktok_confirmed_at timestamptz
);

-- One row per accepted registration, kept for a day, to throttle a single
-- source. Only a hash of the address is stored.
create table maperca.registration_hits (
  ip_hash text not null,
  hit_at timestamptz not null default now()
);
create index registration_hits_ip_time on maperca.registration_hits (ip_hash, hit_at);

alter table maperca.registrations enable row level security;
alter table maperca.registration_hits enable row level security;
revoke all on schema maperca from anon, authenticated;
revoke all on all tables in schema maperca from anon, authenticated;

create function public.maperca_daftar(
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
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_nama text := btrim(coalesce(p_nama, ''));
  v_kampus text := btrim(coalesce(p_kampus, ''));
  v_jurusan text := btrim(coalesce(p_jurusan, ''));
  v_tempat_lahir text := btrim(coalesce(p_tempat_lahir, ''));
  v_alamat text := btrim(coalesce(p_alamat, ''));
  v_hp text := regexp_replace(coalesce(p_hp, ''), '[\s-]', '', 'g');
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
  if char_length(v_nama) not between 2 and 150 then
    raise exception 'Nama lengkap harus 2 sampai 150 karakter.';
  end if;
  if char_length(coalesce(p_hp, '')) > 20 or v_hp !~ '^(08|628|\+628)[0-9]{7,12}$' then
    raise exception 'Nomor HP tidak valid. Gunakan nomor Indonesia: 08…, 628…, atau +628….';
  end if;
  if char_length(v_kampus) not between 2 and 150 then
    raise exception 'Asal kampus harus 2 sampai 150 karakter.';
  end if;
  if char_length(v_jurusan) not between 2 and 150 then
    raise exception 'Jurusan harus 2 sampai 150 karakter.';
  end if;
  if char_length(v_tempat_lahir) not between 2 and 150 then
    raise exception 'Tempat lahir harus 2 sampai 150 karakter.';
  end if;
  if char_length(v_alamat) not between 10 and 500 then
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
      p_request_id, v_nama, v_kampus, v_hp, v_alamat, v_jurusan, v_tempat_lahir, p_tanggal_lahir, p_tanggal_kuliah
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

create function public.maperca_follow(
  p_id text,
  p_request_id uuid,
  p_action text,
  p_platform text default 'instagram'
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row maperca.registrations;
begin
  if coalesce(p_id, '') !~ '^MPR-[A-F0-9]{12}$'
     or p_request_id is null
     or coalesce(p_action, '') not in ('open', 'confirm')
     or (p_action = 'open' and coalesce(p_platform, '') not in ('instagram', 'tiktok')) then
    raise exception 'Konfirmasi belum lengkap.';
  end if;

  -- The request id acts as the owner's proof: it never leaves their browser.
  select * into v_row from maperca.registrations
  where id = p_id and request_id = p_request_id;
  if not found then
    raise exception 'Pendaftaran tidak ditemukan.';
  end if;

  if p_action = 'open' then
    if p_platform = 'tiktok' then
      update maperca.registrations set tiktok_opened_at = coalesce(tiktok_opened_at, now())
      where id = v_row.id;
    else
      update maperca.registrations set instagram_opened_at = coalesce(instagram_opened_at, now())
      where id = v_row.id;
    end if;
    return json_build_object('opened', true);
  end if;

  if v_row.instagram_opened_at is null then
    raise exception 'Buka Instagram @hmipringsewu dan ikuti akunnya terlebih dahulu.';
  end if;
  if v_row.tiktok_opened_at is null then
    raise exception 'Buka TikTok @hmipringsewu dan ikuti akunnya terlebih dahulu.';
  end if;

  -- These are participant declarations, not verification from the platforms.
  update maperca.registrations
  set instagram_confirmed_at = coalesce(instagram_confirmed_at, now()),
      tiktok_confirmed_at = coalesce(tiktok_confirmed_at, now())
  where id = v_row.id;

  return json_build_object('followConfirmed', true, 'tiktokConfirmed', true);
end;
$$;

revoke execute on function public.maperca_daftar(uuid, text, text, text, text, text, text, date, date, boolean) from public;
revoke execute on function public.maperca_follow(text, uuid, text, text) from public;
grant execute on function public.maperca_daftar(uuid, text, text, text, text, text, text, date, date, boolean) to anon, authenticated;
grant execute on function public.maperca_follow(text, uuid, text, text) to anon, authenticated;
