-- Admin access to the registrant list.
--
-- Anyone can create a Supabase Auth account on this project, so an account by
-- itself grants nothing. Only a signed-in user whose confirmed email is listed
-- in maperca.admins can read registrations, and only through the function
-- below. The admin page is static and its code is public, so this check has to
-- live in the database.

create table maperca.admins (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table maperca.admins enable row level security;
revoke all on maperca.admins from anon, authenticated;

create function public.maperca_admin_list()
returns json
language plpgsql
security definer
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

revoke execute on function public.maperca_admin_list() from public, anon;
grant execute on function public.maperca_admin_list() to authenticated;
