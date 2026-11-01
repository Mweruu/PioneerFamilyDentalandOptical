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
