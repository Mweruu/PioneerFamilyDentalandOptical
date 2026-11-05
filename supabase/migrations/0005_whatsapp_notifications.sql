-- ============================================================================
-- 0005 — WhatsApp reminder channel
--
-- Adds WhatsApp as a notification channel and a dedicated clinic setting.
-- Reminders are delivered on every channel that is enabled in the admin UI
-- and has provider credentials in the server environment.
--
-- WhatsApp is disabled by default: patient messaging needs an explicit opt-in
-- from the clinic, and the Meta Cloud API needs an approved message template.
-- ============================================================================

alter type public.notification_channel add value if not exists 'whatsapp';

insert into public.clinic_settings (key, value) values
  ('notification_whatsapp_enabled', 'false')
on conflict (key) do nothing;

-- Reminder template contract (create and get this approved in Meta Business
-- Manager before enabling WhatsApp). The body must use these positional
-- parameters in order:
--
--   Hello {{1}}, this is a reminder of your {{2}} appointment at {{3}} on
--   {{4}} at {{5}} with {{6}}. Reference {{7}}. Call {{8}}.
--
--   1 patient name, 2 department, 3 clinic name, 4 appointment date,
--   5 appointment time, 6 clinician, 7 appointment reference, 8 clinic phone.
--
-- Configure its name with WHATSAPP_TEMPLATE_NAME (default: appointment_reminder)
-- and its language with WHATSAPP_TEMPLATE_LANGUAGE (default: en).
