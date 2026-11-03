-- ============================================================================
-- Pioneer Family Dental and Optical Clinic
-- Demo seed for Supabase (optional, development only)
--
-- Run AFTER the migrations in supabase/migrations. Creates the demo staff
-- accounts documented in README.md, the clinic settings, the service catalogue
-- and weekly clinician schedules. Safe to re-run.
--
-- WARNING: the demo passwords are public. Do not run this against production.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Demo staff: auth.users + auth.identities + public.staff
-- ---------------------------------------------------------------------------
do $$
declare
  account record;
begin
  for account in
    select * from (values
      ('11111111-1111-1111-1111-111111111111'::uuid, 'Clinic Administrator', 'admin@pioneerclinic.co.ke',        'Admin@12345',    'admin'),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'Grace Achieng',       'reception@pioneerclinic.co.ke',    'Reception@123',  'receptionist'),
      ('33333333-3333-3333-3333-333333333333'::uuid, 'Dr. Wanjiku Kamau',   'dentist@pioneerclinic.co.ke',      'Dentist@123',    'dentist'),
      ('44444444-4444-4444-4444-444444444444'::uuid, 'Dr. Samuel Kariuki',  'dentist2@pioneerclinic.co.ke',     'Dentist@123',    'dentist'),
      ('55555555-5555-5555-5555-555555555555'::uuid, 'Dr. Brian Otieno',    'optometrist@pioneerclinic.co.ke',  'Optical@123',    'eye_doctor')
    ) as t(id, name, email, password, role)
  loop
    if not exists (select 1 from auth.users where id = account.id) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        account.id,
        'authenticated',
        'authenticated',
        account.email,
        extensions.crypt(account.password, extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', account.name),
        now(),
        now(),
        '', '', '', '', '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        account.id,
        account.id::text,
        jsonb_build_object('sub', account.id::text, 'email', account.email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
      );
    end if;

    insert into public.staff (id, name, email, role, title, active)
    values (
      account.id,
      account.name,
      account.email,
      account.role::staff_role,
      case account.role
        when 'admin' then 'Clinic Administrator'
        when 'receptionist' then 'Front Desk & Triage'
        when 'dentist' then 'Dental Surgeon'
        else 'Optometrist'
      end,
      true
    )
    on conflict (id) do update
      set name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          title = excluded.title,
          active = true;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Clinic settings
-- ---------------------------------------------------------------------------
insert into public.clinic_settings (key, value) values
  ('clinic_name', 'Pioneer Family Dental and Optical Clinic'),
  ('clinic_phone', '+254 705 188 578'),
  ('clinic_email', 'hello@pioneerclinic.co.ke'),
  ('clinic_address', 'Buruburu Phase 1 along Outering Road Junction (opposite the bus terminus), Nairobi, Kenya'),
  ('clinic_hours', 'Mon-Fri: 8:00 AM - 8:00 PM · Sat: 8:00 AM - 6:00 PM'),
  ('appointment_duration', '30'),
  ('notification_sms_enabled', 'false'),
  ('notification_email_enabled', 'false'),
  ('notification_sender', 'Pioneer Family Clinic'),
  ('privacy_contact', 'privacy@pioneerclinic.co.ke')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Service catalogue
-- ---------------------------------------------------------------------------
insert into public.services (department, name, description, duration_minutes, price, active)
select t.department, t.name, t.description, t.duration_minutes, t.price, true
from (values
  ('dental'::department,  'Dental consultation',  'Assessment, diagnosis and a personalised treatment plan.', 30, 1500::numeric),
  ('dental',              'Dental examination',   'Comprehensive oral examination and preventive advice.', 30, 1000),
  ('dental',              'Tooth filling',        'Restoration of a decayed or damaged tooth.', 45, 3500),
  ('dental',              'Tooth extraction',     'Safe removal of a tooth when preservation is not possible.', 45, 3000),
  ('dental',              'Scaling & polishing',  'Professional cleaning to remove plaque and tartar.', 40, 2500),
  ('dental',              'Root canal treatment', 'Treatment to save an infected or badly damaged tooth.', 60, 12000),
  ('optical',             'Eye examination',      'Comprehensive vision and eye health assessment.', 30, 1500),
  ('optical',             'Vision testing',       'Visual acuity and functional vision testing.', 20, 800),
  ('optical',             'Refraction',           'Measurement of refractive error for spectacles.', 30, 1200),
  ('optical',             'Spectacle prescription', 'Prescription issued after a refraction assessment.', 20, 1000),
  ('optical',             'Eye health assessment', 'Anterior and posterior segment examination.', 40, 2500),
  ('optical',             'Optical follow-up',    'Review of treatment, prescription or eye health.', 20, 800)
) as t(department, name, description, duration_minutes, price)
where not exists (
  select 1 from public.services s where s.department = t.department and s.name = t.name
);

-- ---------------------------------------------------------------------------
-- Weekly schedules: Monday-Saturday, 08:00-17:00 with a 13:00-14:00 break
-- ---------------------------------------------------------------------------
insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time, break_start, break_end, slot_minutes, active)
select s.id, d.weekday, '08:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 30, true
from public.staff s
cross join generate_series(1, 6) as d(weekday)
where s.role in ('dentist', 'eye_doctor')
on conflict (doctor_id, weekday) do nothing;
