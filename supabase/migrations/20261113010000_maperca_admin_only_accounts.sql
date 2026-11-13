-- Only allowlisted admin emails can ever get an account on this project.
--
-- The admin page lets anyone try to create an account, and an account alone
-- already grants no access to registrations (maperca.admins decides that). This
-- goes one step further: the database refuses to create any other account at
-- all, so there is nobody to sign in except the admins. It is a second lock
-- behind switching off "Allow new users to sign up" in the Auth settings; if
-- someone later switches sign-ups back on, strangers still cannot get in.
--
-- To add an admin: insert their email into maperca.admins, switch sign-ups on
-- for the minute they create the account, then switch them off again.

create or replace function maperca.only_admin_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from maperca.admins a where lower(a.email) = lower(new.email)) then
    raise exception 'Akun baru hanya untuk email admin yang terdaftar.';
  end if;
  return new;
end;
$$;

revoke all on function maperca.only_admin_accounts() from public, anon, authenticated;

drop trigger if exists maperca_only_admin_accounts on auth.users;
create trigger maperca_only_admin_accounts
  before insert on auth.users
  for each row execute function maperca.only_admin_accounts();
