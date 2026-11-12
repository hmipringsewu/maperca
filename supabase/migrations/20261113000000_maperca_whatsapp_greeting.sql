-- WhatsApp greeting right after a registration, sent through Fonnte.
--
-- The site is static and its code is public, so the Fonnte token must never
-- appear in it. It lives in Supabase Vault and is read only inside the
-- trigger function below. One-time setup, run by the project owner (never
-- commit the real value):
--
--   select vault.create_secret('<FONNTE DEVICE TOKEN>', 'fonnte_token', 'Fonnte device token for the registration greeting');
--
-- Without that secret the trigger does nothing, so registrations keep working.
--
-- The WhatsApp group invite link is stored the same way and is added to the
-- message when present. It stays out of this public repo on purpose: anyone
-- who finds an invite link can join the group.
--
--   select vault.create_secret('<GROUP INVITE LINK>', 'wa_group_link', 'WhatsApp group invite link for the registration greeting');

create extension if not exists pg_net;

alter table maperca.registrations add column if not exists wa_request_id bigint;

create or replace function maperca.notify_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_target text;
  v_message text;
  v_group text;
  v_group_line text := '';
  v_request bigint;
begin
  -- A failed notification must never undo or block a registration.
  begin
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'fonnte_token';
    if v_token is null then
      return new;
    end if;

    -- Anyone can type any number into the form. Greet a number at most once a day...
    if exists (
      select 1 from maperca.registrations r
      where r.hp = new.hp and r.id <> new.id and r.wa_request_id is not null
        and r.consent_at > now() - interval '24 hours'
    ) then
      return new;
    end if;
    -- ...and cap the total per hour, so abuse cannot burn the message quota.
    if (select count(*) from maperca.registrations
        where wa_request_id is not null and consent_at > now() - interval '1 hour') >= 200 then
      return new;
    end if;

    select decrypted_secret into v_group from vault.decrypted_secrets where name = 'wa_group_link';
    if v_group is not null and btrim(v_group) <> '' then
      v_group_line := E'Untuk informasi dan pengumuman, silakan masuk ke grup WhatsApp peserta:\n' || btrim(v_group) || E'\n\n';
    end if;

    -- 08xx / +628xx / 628xx -> 628xx
    v_target := case
      when new.hp like '+%' then substr(new.hp, 2)
      when new.hp like '0%' then '62' || substr(new.hp, 2)
      else new.hp
    end;

    -- Explicit concatenation: adjacent string literals only continue each other while they use the same prefix.
    v_message := E'Assalamu''alaikum warahmatullahi wabarakatuh, ' || split_part(new.nama, ' ', 1) || E'.\n\n'
      || E'Terima kasih sudah mendaftar *Open Recruitment HMI Cabang Pringsewu*. Data kamu sudah kami terima.\n\n'
      || E'Nomor bukti pendaftaran: *' || new.id || E'*\n'
      || E'Simpan nomor ini untuk konfirmasi kepada panitia.\n\n'
      || E'Panitia akan menghubungi kamu lewat nomor ini untuk informasi selanjutnya. Kamu juga bisa mengikuti kami di Instagram dan TikTok @hmipringsewu.\n\n'
      || v_group_line
      || E'Jika kamu tidak merasa mendaftar, abaikan pesan ini.\n\n'
      || E'Wassalamu''alaikum warahmatullahi wabarakatuh.\nHMI Cabang Pringsewu';

    select net.http_post(
      url := 'https://api.fonnte.com/send',
      body := jsonb_build_object('target', v_target, 'message', v_message),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_token)
    ) into v_request;

    -- pg_net answers asynchronously; the id lets the answer be looked up in net._http_response
    update maperca.registrations set wa_request_id = v_request where id = new.id;
  exception when others then
    raise warning 'maperca notify_whatsapp failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function maperca.notify_whatsapp() from public, anon, authenticated;

drop trigger if exists registrations_notify_whatsapp on maperca.registrations;
create trigger registrations_notify_whatsapp
  after insert on maperca.registrations
  for each row execute function maperca.notify_whatsapp();
