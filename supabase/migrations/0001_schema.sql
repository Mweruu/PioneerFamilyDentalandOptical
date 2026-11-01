-- ============================================================================
-- Pioneer Family Dental and Optical Clinic
-- Supabase / PostgreSQL schema
--
-- This is the production deployment blueprint. The running demo uses SQLite
-- (lib/db.ts) because no Supabase project is available in this environment.
-- Apply with:  supabase db push
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
