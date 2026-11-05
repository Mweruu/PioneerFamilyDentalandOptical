-- ============================================================================
-- Pioneer Family Dental and Optical Clinic
-- Combined Supabase schema: migrations 0001 -> 0005
-- Paste this whole file into the Supabase SQL Editor and run it once on a fresh project.
-- Generated from supabase/migrations. Do not edit by hand; edit the migrations.
-- ============================================================================


-- ############################################################################
-- BEGIN 0001_schema.sql
-- ############################################################################

-- ============================================================================
-- Pioneer Family Dental and Optical Clinic
-- Supabase / PostgreSQL schema
--
-- Apply with:  supabase db push   (or paste supabase/apply_all.sql into the
-- Supabase SQL Editor)
--
-- Staff accounts live in auth.users (Supabase Auth). The `staff` table is the
-- authorisation profile that maps an auth user to a clinic role. A role is
-- NEVER accepted from the client: it is read from this table by RLS helpers.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
do $$ begin
  create type staff_role as enum ('dentist', 'receptionist', 'eye_doctor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type department as enum ('dental', 'optical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum (
    'Booked', 'Confirmed', 'Checked In', 'Waiting for Doctor',
    'In Consultation', 'Completed', 'Cancelled', 'No Show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type visit_status as enum ('Waiting', 'In Consultation', 'Completed', 'Cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dentition_kind as enum ('permanent', 'primary');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_priority as enum ('Low', 'Medium', 'High');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_status as enum ('Planned', 'In Progress', 'Completed', 'Cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('sms', 'email');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('queued', 'sent', 'failed', 'not_configured');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at accurate
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff / authorisation profile
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role staff_role not null,
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_role on public.staff (role) where active;

drop trigger if exists trg_staff_updated on public.staff;
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Patients (shared master record)
-- ---------------------------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_number text not null unique,
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  gender text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text,
  medical_history text,
  medications text,
  conditions text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_phone on public.patients (phone);
create index if not exists idx_patients_name on public.patients (full_name);

drop trigger if exists trg_patients_updated on public.patients;
create trigger trg_patients_updated before update on public.patients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Services, schedules, blocked periods
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  department department not null,
  name text not null,
  description text,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  price numeric(12, 2) check (price is null or price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.staff (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 240),
  active boolean not null default true,
  unique (doctor_id, weekday),
  check (end_time > start_time)
);

create table if not exists public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.staff (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  patient_id uuid references public.patients (id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  gender text,
  department department not null,
  doctor_id uuid not null references public.staff (id),
  service_id uuid references public.services (id) on delete set null,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  reason text not null,
  patient_type text not null default 'new' check (patient_type in ('new', 'returning')),
  notes text,
  status appointment_status not null default 'Booked',
  source text not null default 'online' check (source in ('online', 'walk_in', 'staff')),
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_doctor on public.appointments (doctor_id, appointment_date);
create index if not exists idx_appointments_patient on public.appointments (patient_id);
create index if not exists idx_appointments_phone on public.appointments (phone);

-- Double-booking guard: one active appointment per doctor / date / start time.
create unique index if not exists idx_appointments_exact_slot
  on public.appointments (doctor_id, appointment_date, appointment_time)
  where status not in ('Cancelled', 'No Show');

drop trigger if exists trg_appointments_updated on public.appointments;
create trigger trg_appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Visits and vitals
-- ---------------------------------------------------------------------------
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  department department not null,
  doctor_id uuid references public.staff (id) on delete set null,
  status visit_status not null default 'Waiting',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_visits_patient on public.visits (patient_id, created_at);

create table if not exists public.vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  bp_systolic integer check (bp_systolic is null or bp_systolic between 40 and 300),
  bp_diastolic integer check (bp_diastolic is null or bp_diastolic between 20 and 200),
  pulse integer check (pulse is null or pulse between 20 and 250),
  temperature_c numeric(4, 1) check (temperature_c is null or temperature_c between 25 and 45),
  respiratory_rate integer check (respiratory_rate is null or respiratory_rate between 4 and 80),
  spo2 integer check (spo2 is null or spo2 between 40 and 100),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 0.5 and 500),
  height_cm numeric(6, 2) check (height_cm is null or height_cm between 20 and 260),
  bmi numeric(5, 2),
  observations text,
  recorded_by uuid not null references public.staff (id),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_vitals_patient on public.vitals (patient_id, recorded_at);

-- ---------------------------------------------------------------------------
-- Dental clinical records
-- ---------------------------------------------------------------------------
create table if not exists public.dental_visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  doctor_id uuid not null references public.staff (id),
  visit_date date not null,
  presenting_complaint text,
  history text,
  examination_findings text,
  diagnosis text,
  treatment_performed text,
  medications text,
  advice text,
  follow_up text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dental_visits_patient on public.dental_visits (patient_id, visit_date);

drop trigger if exists trg_dental_visits_updated on public.dental_visits;
create trigger trg_dental_visits_updated before update on public.dental_visits
  for each row execute function public.set_updated_at();

create table if not exists public.tooth_findings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  dental_visit_id uuid not null references public.dental_visits (id) on delete cascade,
  tooth_number text not null,
  dentition dentition_kind not null default 'permanent',
  condition text not null,
  surfaces jsonb,
  diagnosis text,
  planned_treatment text,
  treatment_performed text,
  treatment_date date,
  notes text,
  status text not null default 'Planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dental_visit_id, tooth_number)
);

create index if not exists idx_tooth_findings_patient on public.tooth_findings (patient_id, tooth_number);

drop trigger if exists trg_tooth_findings_updated on public.tooth_findings;
create trigger trg_tooth_findings_updated before update on public.tooth_findings
  for each row execute function public.set_updated_at();

create table if not exists public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  dental_visit_id uuid references public.dental_visits (id) on delete set null,
  tooth_numbers text not null,
  diagnosis text not null,
  procedure text not null,
  priority plan_priority not null default 'Medium',
  estimated_cost numeric(12, 2) check (estimated_cost is null or estimated_cost >= 0),
  status plan_status not null default 'Planned',
  notes text,
  next_review_date date,
  created_by uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_treatment_plans_patient on public.treatment_plans (patient_id, created_at);

drop trigger if exists trg_treatment_plans_updated on public.treatment_plans;
create trigger trg_treatment_plans_updated before update on public.treatment_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Optical clinical records
-- ---------------------------------------------------------------------------
create table if not exists public.optical_visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  doctor_id uuid not null references public.staff (id),
  visit_date date not null,
  presenting_complaint text,
  symptoms jsonb,
  unaided_va_od text,
  unaided_va_os text,
  pinhole_va_od text,
  pinhole_va_os text,
  corrected_va_od text,
  corrected_va_os text,
  external_examination text,
  anterior_segment text,
  posterior_segment text,
  iop_od text,
  iop_os text,
  colour_vision text,
  diagnosis text,
  management_plan text,
  referral text,
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_optical_visits_patient on public.optical_visits (patient_id, visit_date);

drop trigger if exists trg_optical_visits_updated on public.optical_visits;
create trigger trg_optical_visits_updated before update on public.optical_visits
  for each row execute function public.set_updated_at();

create table if not exists public.optical_prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  optical_visit_id uuid references public.optical_visits (id) on delete set null,
  doctor_id uuid not null references public.staff (id),
  od_sph text,
  od_cyl text,
  od_axis text,
  od_add text,
  od_prism text,
  od_base text,
  os_sph text,
  os_cyl text,
  os_axis text,
  os_add text,
  os_prism text,
  os_base text,
  pd text,
  pd_od text,
  pd_os text,
  lens_type text,
  lens_recommendation text,
  frame_recommendation text,
  notes text,
  prescribed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_optical_rx_patient on public.optical_prescriptions (patient_id, prescribed_at);

-- ---------------------------------------------------------------------------
-- Notifications, audit, password resets, settings
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete cascade,
  channel notification_channel not null,
  recipient text not null,
  template text not null,
  status notification_status not null default 'queued',
  payload jsonb,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_appointment on public.notifications (appointment_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  patient_id uuid,
  details text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_patient on public.audit_logs (patient_id);

-- Password resets are handled by Supabase Auth. This table is kept only if an
-- operator wants the legacy self-managed flow; it is not exposed to clients.
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clinic_settings_updated on public.clinic_settings;
create trigger trg_clinic_settings_updated before update on public.clinic_settings
  for each row execute function public.set_updated_at();


-- ############################################################################
-- END 0001_schema.sql
-- ############################################################################


-- ############################################################################
-- BEGIN 0002_rls.sql
-- ############################################################################

-- ============================================================================
-- Pioneer Family Dental and Optical Clinic
-- Row Level Security, least-privilege grants and immutability guards
--
-- Authorisation is derived from public.staff (server-owned). The client can
-- never choose its own role. Every helper below is SECURITY DEFINER so that
-- policy checks do not recurse through the staff RLS policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_role()
returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff where id = auth.uid() and active = true;
$$;

create or replace function public.has_role(required staff_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where id = auth.uid() and active = true and role = any (required)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(array['admin']::staff_role[]); $$;

create or replace function public.is_receptionist()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(array['receptionist']::staff_role[]); $$;

create or replace function public.is_dentist()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(array['dentist']::staff_role[]); $$;

create or replace function public.is_eye_doctor()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(array['eye_doctor']::staff_role[]); $$;

-- True when the signed-in clinician has a booked appointment or visit for the
-- patient. Reception and administration need the master record to register
-- and report, but administration is deliberately excluded from clinical tables.
create or replace function public.can_access_patient(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_receptionist()
      or public.is_admin()
      or exists (
        select 1 from public.appointments a
        where a.patient_id = pid and a.doctor_id = auth.uid()
      )
      or exists (
        select 1 from public.visits v
        where v.patient_id = pid and v.doctor_id = auth.uid()
      );
$$;

-- Clinical access excludes administrators. Used for vitals and any future
-- shared clinical table that is not department-specific.
create or replace function public.can_access_clinical_patient(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_receptionist()
      or exists (
        select 1 from public.appointments a
        where a.patient_id = pid and a.doctor_id = auth.uid()
      )
      or exists (
        select 1 from public.visits v
        where v.patient_id = pid and v.doctor_id = auth.uid()
      );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.staff                enable row level security;
alter table public.patients             enable row level security;
alter table public.services             enable row level security;
alter table public.doctor_schedules     enable row level security;
alter table public.blocked_periods      enable row level security;
alter table public.appointments         enable row level security;
alter table public.visits               enable row level security;
alter table public.vitals               enable row level security;
alter table public.dental_visits        enable row level security;
alter table public.tooth_findings       enable row level security;
alter table public.treatment_plans      enable row level security;
alter table public.optical_visits       enable row level security;
alter table public.optical_prescriptions enable row level security;
alter table public.notifications        enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.clinic_settings      enable row level security;

-- No public (anon) access to any clinic table. Public booking and appointment
-- lookup run in a server action with the service role after input validation.
do $$
declare t text;
begin
  foreach t in array array[
    'staff','patients','services','doctor_schedules','blocked_periods',
    'appointments','visits','vitals','dental_visits','tooth_findings',
    'treatment_plans','optical_visits','optical_prescriptions','notifications',
    'audit_logs','password_reset_tokens','clinic_settings'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- staff: a user may read their own profile; only administrators manage staff
-- ---------------------------------------------------------------------------
drop policy if exists staff_select_self_or_admin on public.staff;
create policy staff_select_self_or_admin on public.staff
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists staff_insert_admin on public.staff;
create policy staff_insert_admin on public.staff
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists staff_update_admin on public.staff;
create policy staff_update_admin on public.staff
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists staff_delete_admin on public.staff;
create policy staff_delete_admin on public.staff
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select to authenticated
  using (public.can_access_patient(id));

drop policy if exists patients_insert_reception_admin on public.patients;
create policy patients_insert_reception_admin on public.patients
  for insert to authenticated
  with check (public.has_role(array['receptionist','admin']::staff_role[]));

drop policy if exists patients_update_reception_admin on public.patients;
create policy patients_update_reception_admin on public.patients
  for update to authenticated
  using (public.has_role(array['receptionist','admin']::staff_role[]))
  with check (public.has_role(array['receptionist','admin']::staff_role[]));

drop policy if exists patients_delete_admin on public.patients;
create policy patients_delete_admin on public.patients
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    public.has_role(array['receptionist','admin']::staff_role[])
    or doctor_id = auth.uid()
  );

drop policy if exists appointments_insert_reception_admin on public.appointments;
create policy appointments_insert_reception_admin on public.appointments
  for insert to authenticated
  with check (public.has_role(array['receptionist','admin']::staff_role[]));

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated
  using (
    public.has_role(array['receptionist','admin']::staff_role[])
    or doctor_id = auth.uid()
  )
  with check (
    public.has_role(array['receptionist','admin']::staff_role[])
    or doctor_id = auth.uid()
  );

drop policy if exists appointments_delete_admin on public.appointments;
create policy appointments_delete_admin on public.appointments
  for delete to authenticated
  using (public.is_admin());

-- Clinicians may progress their own appointment but may not hand it to another
-- doctor or move it to a different day/time; reception owns scheduling.
create or replace function public.guard_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r staff_role;
begin
  r := public.current_staff_role();
  if r in ('dentist', 'eye_doctor') then
    if new.doctor_id <> old.doctor_id
       or new.appointment_date <> old.appointment_date
       or new.appointment_time <> old.appointment_time
       or new.department <> old.department then
      raise exception 'Only reception or an administrator can reschedule or reassign an appointment.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_appointment_update on public.appointments;
create trigger trg_guard_appointment_update before update on public.appointments
  for each row execute function public.guard_appointment_update();

-- ---------------------------------------------------------------------------
-- visits
-- ---------------------------------------------------------------------------
drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits
  for select to authenticated
  using (
    public.has_role(array['receptionist','admin']::staff_role[])
    or doctor_id = auth.uid()
  );

drop policy if exists visits_insert_reception_admin on public.visits;
create policy visits_insert_reception_admin on public.visits
  for insert to authenticated
  with check (public.has_role(array['receptionist','admin']::staff_role[]));

drop policy if exists visits_update on public.visits;
create policy visits_update on public.visits
  for update to authenticated
  using (
    public.has_role(array['receptionist','admin']::staff_role[])
    or doctor_id = auth.uid()
  )
  with check (
    public.has_role(array['receptionist','admin']::staff_role[])
    or doctor_id = auth.uid()
  );

drop policy if exists visits_delete_admin on public.visits;
create policy visits_delete_admin on public.visits
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- vitals: reception records, clinicians read for their patients
-- ---------------------------------------------------------------------------
drop policy if exists vitals_select on public.vitals;
create policy vitals_select on public.vitals
  for select to authenticated
  using (public.can_access_clinical_patient(patient_id));

drop policy if exists vitals_insert_reception on public.vitals;
create policy vitals_insert_reception on public.vitals
  for insert to authenticated
  with check (public.is_receptionist());

drop policy if exists vitals_update_reception on public.vitals;
create policy vitals_update_reception on public.vitals
  for update to authenticated
  using (public.is_receptionist())
  with check (public.is_receptionist());

drop policy if exists vitals_delete_reception on public.vitals;
create policy vitals_delete_reception on public.vitals
  for delete to authenticated
  using (public.is_receptionist());

-- ---------------------------------------------------------------------------
-- Dental records: dentists only. Read the shared dental history; write only
-- records they created (matches the server action ownership checks).
-- ---------------------------------------------------------------------------
drop policy if exists dental_visits_select on public.dental_visits;
create policy dental_visits_select on public.dental_visits
  for select to authenticated
  using (public.is_dentist());

drop policy if exists dental_visits_insert_own on public.dental_visits;
create policy dental_visits_insert_own on public.dental_visits
  for insert to authenticated
  with check (public.is_dentist() and doctor_id = auth.uid());

drop policy if exists dental_visits_update_own on public.dental_visits;
create policy dental_visits_update_own on public.dental_visits
  for update to authenticated
  using (public.is_dentist() and doctor_id = auth.uid())
  with check (public.is_dentist() and doctor_id = auth.uid());

drop policy if exists dental_visits_delete_own on public.dental_visits;
create policy dental_visits_delete_own on public.dental_visits
  for delete to authenticated
  using (public.is_dentist() and doctor_id = auth.uid());

drop policy if exists tooth_findings_select on public.tooth_findings;
create policy tooth_findings_select on public.tooth_findings
  for select to authenticated
  using (public.is_dentist());

drop policy if exists tooth_findings_insert_own on public.tooth_findings;
create policy tooth_findings_insert_own on public.tooth_findings
  for insert to authenticated
  with check (
    public.is_dentist()
    and exists (
      select 1 from public.dental_visits dv
      where dv.id = dental_visit_id and dv.doctor_id = auth.uid()
    )
  );

drop policy if exists tooth_findings_update_own on public.tooth_findings;
create policy tooth_findings_update_own on public.tooth_findings
  for update to authenticated
  using (
    public.is_dentist()
    and exists (
      select 1 from public.dental_visits dv
      where dv.id = dental_visit_id and dv.doctor_id = auth.uid()
    )
  )
  with check (
    public.is_dentist()
    and exists (
      select 1 from public.dental_visits dv
      where dv.id = dental_visit_id and dv.doctor_id = auth.uid()
    )
  );

drop policy if exists tooth_findings_delete_own on public.tooth_findings;
create policy tooth_findings_delete_own on public.tooth_findings
  for delete to authenticated
  using (
    public.is_dentist()
    and exists (
      select 1 from public.dental_visits dv
      where dv.id = dental_visit_id and dv.doctor_id = auth.uid()
    )
  );

drop policy if exists treatment_plans_select on public.treatment_plans;
create policy treatment_plans_select on public.treatment_plans
  for select to authenticated
  using (public.is_dentist());

drop policy if exists treatment_plans_insert_own on public.treatment_plans;
create policy treatment_plans_insert_own on public.treatment_plans
  for insert to authenticated
  with check (public.is_dentist() and created_by = auth.uid());

drop policy if exists treatment_plans_update_own on public.treatment_plans;
create policy treatment_plans_update_own on public.treatment_plans
  for update to authenticated
  using (public.is_dentist() and created_by = auth.uid())
  with check (public.is_dentist() and created_by = auth.uid());

drop policy if exists treatment_plans_delete_own on public.treatment_plans;
create policy treatment_plans_delete_own on public.treatment_plans
  for delete to authenticated
  using (public.is_dentist() and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Optical records: eye doctors only, same ownership model
-- ---------------------------------------------------------------------------
drop policy if exists optical_visits_select on public.optical_visits;
create policy optical_visits_select on public.optical_visits
  for select to authenticated
  using (public.is_eye_doctor());

drop policy if exists optical_visits_insert_own on public.optical_visits;
create policy optical_visits_insert_own on public.optical_visits
  for insert to authenticated
  with check (public.is_eye_doctor() and doctor_id = auth.uid());

drop policy if exists optical_visits_update_own on public.optical_visits;
create policy optical_visits_update_own on public.optical_visits
  for update to authenticated
  using (public.is_eye_doctor() and doctor_id = auth.uid())
  with check (public.is_eye_doctor() and doctor_id = auth.uid());

drop policy if exists optical_visits_delete_own on public.optical_visits;
create policy optical_visits_delete_own on public.optical_visits
  for delete to authenticated
  using (public.is_eye_doctor() and doctor_id = auth.uid());

drop policy if exists optical_rx_select on public.optical_prescriptions;
create policy optical_rx_select on public.optical_prescriptions
  for select to authenticated
  using (public.is_eye_doctor());

drop policy if exists optical_rx_insert_own on public.optical_prescriptions;
create policy optical_rx_insert_own on public.optical_prescriptions
  for insert to authenticated
  with check (public.is_eye_doctor() and doctor_id = auth.uid());

drop policy if exists optical_rx_update_own on public.optical_prescriptions;
create policy optical_rx_update_own on public.optical_prescriptions
  for update to authenticated
  using (public.is_eye_doctor() and doctor_id = auth.uid())
  with check (public.is_eye_doctor() and doctor_id = auth.uid());

drop policy if exists optical_rx_delete_own on public.optical_prescriptions;
create policy optical_rx_delete_own on public.optical_prescriptions
  for delete to authenticated
  using (public.is_eye_doctor() and doctor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications: front desk can read/send; only admin can delete
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (public.has_role(array['receptionist','admin']::staff_role[]));

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (public.has_role(array['receptionist','admin']::staff_role[]));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists notifications_delete_admin on public.notifications;
create policy notifications_delete_admin on public.notifications
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_logs: administrators read; staff may append only their own entries.
-- The table is append-only (no update/delete policy).
-- ---------------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_insert_own on public.audit_logs;
create policy audit_logs_insert_own on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid());

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit logs are append-only.';
end;
$$;

drop trigger if exists trg_audit_logs_no_update on public.audit_logs;
create trigger trg_audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- Configuration tables: all staff read, administrators write
-- ---------------------------------------------------------------------------
drop policy if exists services_select_staff on public.services;
create policy services_select_staff on public.services
  for select to authenticated
  using (public.current_staff_role() is not null);

drop policy if exists services_write_admin on public.services;
create policy services_write_admin on public.services
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists schedules_select_staff on public.doctor_schedules;
create policy schedules_select_staff on public.doctor_schedules
  for select to authenticated
  using (public.current_staff_role() is not null);

drop policy if exists schedules_write_admin on public.doctor_schedules;
create policy schedules_write_admin on public.doctor_schedules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists blocked_select_staff on public.blocked_periods;
create policy blocked_select_staff on public.blocked_periods
  for select to authenticated
  using (public.current_staff_role() is not null);

drop policy if exists blocked_write_admin on public.blocked_periods;
create policy blocked_write_admin on public.blocked_periods
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists settings_select_staff on public.clinic_settings;
create policy settings_select_staff on public.clinic_settings
  for select to authenticated
  using (public.current_staff_role() is not null);

drop policy if exists settings_write_admin on public.clinic_settings;
create policy settings_write_admin on public.clinic_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- password_reset_tokens: intentionally no policies. Only the service role can
-- touch it. Supabase Auth handles password reset emails in production.
-- ---------------------------------------------------------------------------


-- ############################################################################
-- END 0002_rls.sql
-- ############################################################################


-- ############################################################################
-- BEGIN 0003_supabase_app_rpcs.sql
-- ############################################################################

-- ============================================================================
-- Pioneer Family Dental and Optical Clinic
-- Supabase application RPCs and additional RLS
--
-- The browser never receives a role. Public pages call narrowly-scoped
-- SECURITY DEFINER functions; staff pages use the authenticated session and
-- PostgreSQL RLS. Admin report functions are the only way administrators read
-- aggregate clinical data, because administrators are intentionally denied
-- direct access to clinical tables.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Safe public projections
-- ---------------------------------------------------------------------------
create or replace view public.public_staff as
select id, name, role, title, active, created_at
from public.staff
where active = true;

grant select on public.public_staff to anon, authenticated;

drop policy if exists services_select_public on public.services;
create policy services_select_public on public.services
  for select to anon
  using (active = true);

grant select on public.services to anon;

-- ---------------------------------------------------------------------------
-- Additional staff read policies
-- ---------------------------------------------------------------------------

-- Dentists and eye doctors need to open a patient record after finding it in
-- their department-wide patient list. Access remains limited to patients who
-- already have an appointment or visit in the clinician's own department.
drop policy if exists patients_select_department_clinician on public.patients;
create policy patients_select_department_clinician on public.patients
  for select to authenticated
  using (
    (public.is_dentist() and (
      exists (select 1 from public.appointments a where a.patient_id = patients.id and a.department = 'dental')
      or exists (select 1 from public.visits v where v.patient_id = patients.id and v.department = 'dental')
    ))
    or
    (public.is_eye_doctor() and (
      exists (select 1 from public.appointments a where a.patient_id = patients.id and a.department = 'optical')
      or exists (select 1 from public.visits v where v.patient_id = patients.id and v.department = 'optical')
    ))
  );

-- Starting a consultation creates a visit. The original schema only allowed
-- reception and administration to insert visits, so allow a clinician to open
-- a visit that is assigned to themselves and belongs to their department.
drop policy if exists visits_insert_clinician_own on public.visits;
create policy visits_insert_clinician_own on public.visits
  for insert to authenticated
  with check (
    (public.is_dentist() and department = 'dental' and doctor_id = auth.uid())
    or
    (public.is_eye_doctor() and department = 'optical' and doctor_id = auth.uid())
  );

-- Clinicians load their "recent patients" from their own audit entries.
-- Reception already needs audit visibility for appointment history.
drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs
  for select to authenticated
  using (actor_id = auth.uid());

drop policy if exists audit_logs_select_reception on public.audit_logs;
create policy audit_logs_select_reception on public.audit_logs
  for select to authenticated
  using (public.is_receptionist());

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), '^254', '0');
$$;

create or replace function public.clinic_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Africa/Nairobi')::date;
$$;

-- ---------------------------------------------------------------------------
-- Public availability
-- ---------------------------------------------------------------------------
create or replace function public.public_available_slots(
  p_doctor_id uuid,
  p_date date,
  p_duration integer default 30
)
returns table ("time" text, available boolean)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select greatest(coalesce(p_duration, 30), 5) as duration
  ),
  sched as (
    select s.start_time, s.end_time, s.break_start, s.break_end
    from public.doctor_schedules s
    where s.doctor_id = p_doctor_id
      and s.weekday = extract(dow from p_date)::int
      and s.active = true
    limit 1
  ),
  slots as (
    select gs as slot_start,
           gs + make_interval(mins => params.duration) as slot_end
    from sched, params,
      generate_series(
        p_date + sched.start_time,
        p_date + sched.end_time - make_interval(mins => params.duration),
        make_interval(mins => params.duration)
      ) as gs
    where sched.break_start is null
       or sched.break_end is null
       or not (
         gs::time < sched.break_end
         and (gs + make_interval(mins => params.duration))::time > sched.break_start
       )
  )
  select to_char(slot_start, 'HH24:MI') as "time",
         not exists (
           select 1
           from public.appointments a
           where a.doctor_id = p_doctor_id
             and a.appointment_date = p_date
             and a.status not in ('Cancelled', 'No Show')
             and (p_date + a.appointment_time) < slot_end
             and (p_date + a.appointment_time + make_interval(mins => a.duration_minutes)) > slot_start
         )
         and not exists (
           select 1
           from public.blocked_periods b
           where b.doctor_id = p_doctor_id
             and (b.start_at at time zone 'Africa/Nairobi') < slot_end
             and (b.end_at at time zone 'Africa/Nairobi') > slot_start
         ) as available
  from slots
  order by slot_start;
$$;

-- ---------------------------------------------------------------------------
-- Public booking
-- ---------------------------------------------------------------------------
create or replace function public.public_book_appointment(
  p_full_name text,
  p_phone text,
  p_email text,
  p_date_of_birth date,
  p_gender text,
  p_department department,
  p_doctor_id uuid,
  p_service_id uuid,
  p_date date,
  p_time text,
  p_reason text,
  p_patient_type text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor public.staff%rowtype;
  v_service public.services%rowtype;
  v_duration integer;
  v_id uuid := gen_random_uuid();
  v_reference text;
  v_attempt integer := 0;
  v_time time;
  v_patient_type text := coalesce(nullif(trim(p_patient_type), ''), 'new');
begin
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Enter the patient''s full name.');
  end if;

  if p_phone is null or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid phone number.');
  end if;

  if p_date is null or p_date < public.clinic_today() then
    return jsonb_build_object('ok', false, 'error', 'Choose today or a future date.');
  end if;

  if p_time is null or p_time !~ '^[0-9]{2}:[0-9]{2}$' then
    return jsonb_build_object('ok', false, 'error', 'Choose a valid time.');
  end if;

  if v_patient_type not in ('new', 'returning') then
    return jsonb_build_object('ok', false, 'error', 'Select whether you are a new or returning patient.');
  end if;

  v_time := p_time::time;

  select * into v_doctor
  from public.staff
  where id = p_doctor_id and active = true;

  if not found
     or v_doctor.role <> (case when p_department = 'dental' then 'dentist'::staff_role else 'eye_doctor'::staff_role end) then
    return jsonb_build_object('ok', false, 'error', 'The selected doctor is not available for this appointment type.');
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and active = true;

  if not found or v_service.department <> p_department then
    return jsonb_build_object('ok', false, 'error', 'The selected service is not available.');
  end if;

  v_duration := v_service.duration_minutes;

  if not exists (
    select 1
    from public.public_available_slots(p_doctor_id, p_date, v_duration)
    where "time" = to_char(v_time, 'HH24:MI') and available
  ) then
    return jsonb_build_object('ok', false, 'error', 'That time has just been taken. Please choose another available time.');
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'PF-'
      || to_char(now() at time zone 'Africa/Nairobi', 'YYYYMMDD')
      || '-'
      || upper(substr(md5(random()::text), 1, 4));

    begin
      insert into public.appointments (
        id, reference, patient_id, full_name, phone, email, date_of_birth, gender,
        department, doctor_id, service_id, appointment_date, appointment_time, duration_minutes,
        reason, patient_type, notes, status, source, checked_in_at, created_at, updated_at
      ) values (
        v_id, v_reference, null, trim(p_full_name), trim(p_phone),
        nullif(trim(p_email), ''), p_date_of_birth, nullif(trim(p_gender), ''),
        p_department, p_doctor_id, p_service_id, p_date, v_time, v_duration,
        coalesce(nullif(trim(p_reason), ''), 'General consultation'),
        v_patient_type, nullif(trim(p_notes), ''),
        'Booked', 'online', null, now(), now()
      );
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        return jsonb_build_object('ok', false, 'error', 'That appointment slot was just booked by someone else. Please choose another time.');
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'reference', v_reference,
    'date', p_date,
    'time', to_char(v_time, 'HH24:MI'),
    'department', p_department,
    'doctor_name', v_doctor.name,
    'full_name', trim(p_full_name),
    'phone', trim(p_phone),
    'email', nullif(trim(p_email), ''),
    'patient_id', null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public lookup and cancellation
-- ---------------------------------------------------------------------------
create or replace function public.public_lookup_appointment(
  p_reference text,
  p_full_name text,
  p_phone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_doctor_name text;
begin
  select a.* into v_appointment
  from public.appointments a
  where upper(a.reference) = upper(trim(p_reference))
    and lower(trim(a.full_name)) = lower(trim(p_full_name))
    and public.normalize_phone(a.phone) = public.normalize_phone(p_phone)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'We could not verify an appointment with those details. Check the reference, name and phone number.');
  end if;

  select name into v_doctor_name from public.staff where id = v_appointment.doctor_id;

  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object(
      'id', v_appointment.id,
      'patient_id', v_appointment.patient_id,
      'reference', v_appointment.reference,
      'full_name', v_appointment.full_name,
      'phone', v_appointment.phone,
      'email', v_appointment.email,
      'department', v_appointment.department,
      'doctor_name', coalesce(v_doctor_name, 'the clinic'),
      'date', v_appointment.appointment_date,
      'time', to_char(v_appointment.appointment_time, 'HH24:MI'),
      'status', v_appointment.status,
      'cancellable', v_appointment.status in ('Booked', 'Confirmed')
    )
  );
end;
$$;

create or replace function public.public_cancel_appointment(
  p_reference text,
  p_full_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_doctor_name text;
begin
  select a.* into v_appointment
  from public.appointments a
  where upper(a.reference) = upper(trim(p_reference))
    and lower(trim(a.full_name)) = lower(trim(p_full_name))
    and public.normalize_phone(a.phone) = public.normalize_phone(p_phone)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'We could not verify that appointment. No changes were made.');
  end if;

  if v_appointment.status not in ('Booked', 'Confirmed') then
    return jsonb_build_object('ok', false, 'error', 'This appointment can no longer be cancelled online. Please call the clinic.');
  end if;

  update public.appointments
  set status = 'Cancelled', updated_at = now()
  where id = v_appointment.id;

  select name into v_doctor_name from public.staff where id = v_appointment.doctor_id;

  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object(
      'id', v_appointment.id,
      'patient_id', v_appointment.patient_id,
      'reference', v_appointment.reference,
      'full_name', v_appointment.full_name,
      'phone', v_appointment.phone,
      'email', v_appointment.email,
      'department', v_appointment.department,
      'doctor_name', coalesce(v_doctor_name, 'the clinic'),
      'date', v_appointment.appointment_date,
      'time', to_char(v_appointment.appointment_time, 'HH24:MI'),
      'status', 'Cancelled',
      'cancellable', false
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public notification and audit recording
-- ---------------------------------------------------------------------------
create or replace function public.public_appointment_notification(p_appointment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id,
    'reference', a.reference,
    'full_name', a.full_name,
    'phone', a.phone,
    'email', a.email,
    'department', a.department,
    'appointment_date', a.appointment_date,
    'appointment_time', to_char(a.appointment_time, 'HH24:MI'),
    'doctor_name', coalesce(s.name, 'the clinic')
  )
  from public.appointments a
  left join public.staff s on s.id = a.doctor_id
  where a.id = p_appointment_id;
$$;

create or replace function public.public_record_notification(
  p_appointment_id uuid,
  p_reference text,
  p_channel text,
  p_recipient text,
  p_template text,
  p_status text,
  p_payload text,
  p_error text,
  p_sent_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.appointments
    where id = p_appointment_id and reference = p_reference
  ) then
    raise exception 'Appointment not found.';
  end if;

  insert into public.notifications (
    appointment_id, channel, recipient, template, status, payload, error, sent_at
  ) values (
    p_appointment_id,
    p_channel::notification_channel,
    p_recipient,
    p_template,
    p_status::notification_status,
    to_jsonb(p_payload),
    p_error,
    p_sent_at
  );
end;
$$;

create or replace function public.public_log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_patient_id uuid,
  p_details text,
  p_ip text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    actor_id, actor_name, actor_role, action, entity_type, entity_id, patient_id, details, ip
  ) values (
    null, null, null, p_action, p_entity_type, p_entity_id, p_patient_id, p_details, p_ip
  );
end;
$$;

create or replace function public.public_clinic_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from public.clinic_settings;
$$;

-- ---------------------------------------------------------------------------
-- Department patient list (preserves the previous department-wide behaviour)
-- ---------------------------------------------------------------------------
create or replace function public.list_department_patients(
  p_department department,
  p_query text default '',
  p_limit integer default 100
)
returns setof public.patients
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := coalesce(trim(p_query), '');
begin
  if not (
    public.is_receptionist()
    or public.is_admin()
    or (p_department = 'dental' and public.is_dentist())
    or (p_department = 'optical' and public.is_eye_doctor())
  ) then
    raise exception 'Not authorised for this department.';
  end if;

  return query
    select p.*
    from public.patients p
    where (
      exists (
        select 1 from public.appointments a
        where a.patient_id = p.id and a.department = p_department
      )
      or exists (
        select 1 from public.visits v
        where v.patient_id = p.id and v.department = p_department
      )
    )
    and (
      v_query = ''
      or p.full_name ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or p.patient_number ilike '%' || v_query || '%'
    )
    order by p.full_name
    limit greatest(coalesce(p_limit, 100), 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic patient number allocation
-- ---------------------------------------------------------------------------
create or replace function public.next_patient_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  if not (public.is_receptionist() or public.is_admin()) then
    raise exception 'Front desk access required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('pioneer_patient_number'));

  v_prefix := 'PFC-' || to_char(now() at time zone 'Africa/Nairobi', 'YYYY') || '-';

  select coalesce(max((regexp_replace(patient_number, '^PFC-[0-9]{4}-', ''))::int), 0) + 1
  into v_next
  from public.patients
  where patient_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin-only aggregate reports
-- ---------------------------------------------------------------------------
create or replace function public.admin_reports(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'department', d.department,
          'status', d.status,
          'count', d.count
        )
        order by d.department, d.status
      )
      from (
        select department, status, count(*)::int as count
        from public.appointments
        where appointment_date = p_date
        group by department, status
      ) d
    ), '[]'::jsonb),
    'registrations', (
      select count(*)::int from public.patients
      where (created_at at time zone 'Africa/Nairobi')::date = p_date
    ),
    'registrationsMonth', (
      select count(*)::int from public.patients
      where date_trunc('month', created_at at time zone 'Africa/Nairobi') = date_trunc('month', p_date::timestamp)
    ),
    'dentalCompleted', (
      select count(*)::int from public.dental_visits where visit_date = p_date
    ),
    'opticalCompleted', (
      select count(*)::int from public.optical_visits where visit_date = p_date
    ),
    'followUpsDue', (
      select count(*)::int from public.treatment_plans
      where next_review_date is not null and next_review_date <= p_date
        and status in ('Planned', 'In Progress')
    ) + (
      select count(*)::int from public.optical_visits
      where follow_up_date is not null and follow_up_date <= p_date
    ),
    'averageWaitMinutes', (
      select round(avg(extract(epoch from (v.started_at - a.checked_in_at)) / 60))::int
      from public.visits v
      join public.appointments a on a.id = v.appointment_id
      where v.started_at is not null
        and a.checked_in_at is not null
        and a.appointment_date = p_date
    ),
    'cancellations', (
      select count(*)::int from public.appointments
      where appointment_date = p_date and status = 'Cancelled'
    ),
    'noShows', (
      select count(*)::int from public.appointments
      where appointment_date = p_date and status = 'No Show'
    )
  );
end;
$$;

create or replace function public.admin_overview(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return jsonb_build_object(
    'staff', coalesce((
      select jsonb_agg(
        jsonb_build_object('role', s.role, 'count', s.count, 'active', s.active)
        order by s.role
      )
      from (
        select role, count(*)::int as count, count(*) filter (where active)::int as active
        from public.staff
        group by role
      ) s
    ), '[]'::jsonb),
    'staffTotal', (select count(*)::int from public.staff),
    'staffActive', (select count(*)::int from public.staff where active),
    'patients', (select count(*)::int from public.patients),
    'newPatients', (
      select count(*)::int from public.patients
      where date_trunc('month', created_at at time zone 'Africa/Nairobi') = date_trunc('month', p_date::timestamp)
    ),
    'appointments', (
      select count(*)::int from public.appointments where appointment_date = p_date
    ),
    'failedNotifications', (
      select count(*)::int from public.notifications where status = 'failed'
    ),
    'pendingFollowUps', (
      select count(*)::int from public.treatment_plans
      where status in ('Planned', 'In Progress')
        and next_review_date is not null
        and next_review_date <= p_date
    )
  );
end;
$$;

create or replace function public.admin_appointment_trend(p_days integer default 7)
returns table ("date" date, count bigint, completed bigint, missed bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := public.clinic_today();
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
    select a.appointment_date,
           count(*),
           count(*) filter (where a.status = 'Completed'),
           count(*) filter (where a.status in ('Cancelled', 'No Show'))
    from public.appointments a
    where a.appointment_date >= v_today - (greatest(coalesce(p_days, 7), 1) - 1)
    group by a.appointment_date
    order by a.appointment_date;
end;
$$;

create or replace function public.admin_follow_ups_due()
returns table (
  id uuid,
  patient_id uuid,
  dental_visit_id uuid,
  tooth_numbers text,
  diagnosis text,
  procedure text,
  priority text,
  estimated_cost numeric,
  status text,
  notes text,
  next_review_date date,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  patient_number text,
  phone text,
  department department
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := public.clinic_today();
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
    select rows.*
    from (
      select
        tp.id, tp.patient_id, tp.dental_visit_id, tp.tooth_numbers, tp.diagnosis, tp.procedure,
        tp.priority::text, tp.estimated_cost, tp.status::text, tp.notes, tp.next_review_date,
        tp.created_by, tp.created_at, tp.updated_at,
        p.full_name, p.patient_number, p.phone, 'dental'::department as department
      from public.treatment_plans tp
      join public.patients p on p.id = tp.patient_id
      where tp.next_review_date is not null
        and tp.next_review_date <= v_today
        and tp.status in ('Planned', 'In Progress')
      union all
      select
        ov.id, ov.patient_id, null::uuid, ''::text, coalesce(ov.diagnosis, ''), 'Optical follow-up'::text,
        'Medium'::text, null::numeric, 'Planned'::text, ov.management_plan, ov.follow_up_date,
        ov.doctor_id, ov.created_at, ov.updated_at,
        p.full_name, p.patient_number, p.phone, 'optical'::department
      from public.optical_visits ov
      join public.patients p on p.id = ov.patient_id
      where ov.follow_up_date is not null
        and ov.follow_up_date <= v_today
    ) rows
    order by rows.next_review_date;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin staff provisioning fallback
--
-- Preferred path: set SUPABASE_SERVICE_ROLE_KEY and let the server call the
-- Auth Admin API. When the key is absent these SECURITY DEFINER functions let
-- an authenticated administrator create/reset an Auth user from SQL. They
-- require the postgres role to be able to write auth.users/auth.identities; if
-- the project restricts that, configure the service-role key instead.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_staff(
  p_name text,
  p_email text,
  p_password text,
  p_role staff_role,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Enter the staff member''s full name.';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid work email address.';
  end if;

  if length(p_password) < 10 then
    raise exception 'Use at least 10 characters with an uppercase letter, lowercase letter and number.';
  end if;

  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', trim(p_name)),
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_id,
      v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );

    insert into public.staff (id, name, email, role, title, active, created_at, updated_at)
    values (v_id, trim(p_name), v_email, p_role, nullif(trim(p_title), ''), true, now(), now());
  exception
    when unique_violation then
      raise exception 'A staff account with that email already exists.';
  end;

  return v_id;
end;
$$;

create or replace function public.admin_reset_staff_password(
  p_staff_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  if length(p_password) < 10 then
    raise exception 'Use at least 10 characters with an uppercase letter, lowercase letter and number.';
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
  where id = p_staff_id;

  if not found then
    raise exception 'Staff account not found.';
  end if;

  update public.staff set updated_at = now() where id = p_staff_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------
revoke all on function public.public_available_slots(uuid, date, integer) from public;
revoke all on function public.public_book_appointment(text, text, text, date, text, department, uuid, uuid, date, text, text, text, text) from public;
revoke all on function public.public_lookup_appointment(text, text, text) from public;
revoke all on function public.public_cancel_appointment(text, text, text) from public;
revoke all on function public.public_appointment_notification(uuid) from public;
revoke all on function public.public_record_notification(uuid, text, text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.public_log_audit(text, text, text, uuid, text, text) from public;
revoke all on function public.public_clinic_info() from public;

grant execute on function public.public_available_slots(uuid, date, integer) to anon, authenticated;
grant execute on function public.public_book_appointment(text, text, text, date, text, department, uuid, uuid, date, text, text, text, text) to anon, authenticated;
grant execute on function public.public_lookup_appointment(text, text, text) to anon, authenticated;
grant execute on function public.public_cancel_appointment(text, text, text) to anon, authenticated;
grant execute on function public.public_appointment_notification(uuid) to anon, authenticated;
grant execute on function public.public_record_notification(uuid, text, text, text, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.public_log_audit(text, text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.public_clinic_info() to anon, authenticated;

revoke all on function public.list_department_patients(department, text, integer) from public;
revoke all on function public.next_patient_number() from public;
revoke all on function public.admin_reports(date) from public;
revoke all on function public.admin_overview(date) from public;
revoke all on function public.admin_appointment_trend(integer) from public;
revoke all on function public.admin_follow_ups_due() from public;
revoke all on function public.admin_create_staff(text, text, text, staff_role, text) from public;
revoke all on function public.admin_reset_staff_password(uuid, text) from public;

grant execute on function public.list_department_patients(department, text, integer) to authenticated;
grant execute on function public.next_patient_number() to authenticated;
grant execute on function public.admin_reports(date) to authenticated;
grant execute on function public.admin_overview(date) to authenticated;
grant execute on function public.admin_appointment_trend(integer) to authenticated;
grant execute on function public.admin_follow_ups_due() to authenticated;
grant execute on function public.admin_create_staff(text, text, text, staff_role, text) to authenticated;
grant execute on function public.admin_reset_staff_password(uuid, text) to authenticated;


-- ############################################################################
-- END 0003_supabase_app_rpcs.sql
-- ############################################################################


-- ############################################################################
-- BEGIN 0004_staff_directory.sql
-- ############################################################################

-- ============================================================================
-- 0004 â€” Staff directory read access
--
-- The original RLS allowed a staff member to read only their own row (or an
-- administrator to read every row). Reception and the appointment tables embed
-- `staff` to display the clinician's name, and the reception booking flow needs
-- the list of dentists/optometrists. Without this policy those reads return no
-- rows, so names show as "Unknown clinician" and the doctor picker is empty.
--
-- Any active staff member may read the staff directory. The public boundary is
-- still the `public_staff` view, which exposes only name/role/title and is the
-- only staff data available to anonymous visitors.
-- ============================================================================

drop policy if exists staff_select_directory on public.staff;
create policy staff_select_directory on public.staff
  for select to authenticated
  using (public.current_staff_role() is not null);


-- ############################################################################
-- END 0004_staff_directory.sql
-- ############################################################################


-- ############################################################################
-- BEGIN 0005_whatsapp_notifications.sql
-- ############################################################################

-- ============================================================================
-- 0005 â€” WhatsApp reminder channel
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


-- ############################################################################
-- END 0005_whatsapp_notifications.sql
-- ############################################################################
