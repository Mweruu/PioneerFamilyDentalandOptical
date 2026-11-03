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
