# Pioneer Family Dental and Optical Clinic

A complete clinic management system for a combined dental and optical practice in Kenya. It covers public appointment booking, secure staff authentication with four roles, reception and triage, dental charting, eye examinations and spectacle prescriptions, administration, reporting, notifications, and audit logging.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Supabase** (PostgreSQL, Auth, and Row Level Security).

---

## Quick start

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + publishable key
npm run dev                  # http://localhost:3000
npm run build                # production build
npm start                    # serve the production build
```

The app stores everything in Supabase (PostgreSQL + Auth). Apply the schema once with `supabase/apply_all.sql` (see [Supabase setup](#supabase-setup)), then optionally run `supabase/seed.sql` for demo data.

Create `.env.local` from `.env.example` before deploying. The minimum is `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; add `SUPABASE_SERVICE_ROLE_KEY` if you want the admin UI to create staff accounts through the Auth admin API. Set `NEXT_PUBLIC_APP_URL` so password-reset emails link back to the right host.

### Demo accounts

These accounts come from `supabase/seed.sql`. **Remove or change them before production** (do not run the seed against a live clinic, and provision real staff through Supabase Auth or the admin UI).

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@pioneerclinic.co.ke` | `Admin@12345` |
| Receptionist | `reception@pioneerclinic.co.ke` | `Reception@123` |
| Dentist | `dentist@pioneerclinic.co.ke` | `Dentist@123` |
| Dentist | `dentist2@pioneerclinic.co.ke` | `Dentist@123` |
| Eye Doctor | `optometrist@pioneerclinic.co.ke` | `Optical@123` |

Demo patients are created through the app (public booking or reception). Keep the seeded staff accounts for evaluation only.

---

## Feature map

### Public site (no patient account required)

| Route | Purpose |
| --- | --- |
| `/` | Clinic home page with services, hours, and booking calls to action |
| `/services` | Dental and optical service catalogue with prices and durations |
| `/book` | Appointment booking with doctor, service, and available slot selection |
| `/appointment` | Look up and cancel an appointment using reference + full name + phone |
| `/privacy` | Privacy notice aligned with the Kenya Data Protection Act, 2019 |
| `/login`, `/forgot-password`, `/reset-password` | Staff authentication and password reset |

Public booking is validated server-side, checks the doctor's weekly schedule, existing appointments, and blocked periods, and is protected by a partial unique index that prevents two active bookings at the same doctor/date/time. Public lookup requires all three identifiers, so a reference number alone is not enough to view or cancel a booking.

### Reception

- Search and register patients, including allergies, medical history, and emergency contacts.
- Book, reschedule, and cancel appointments; check patients in and move them through the queue.
- Record vitals (blood pressure, pulse, temperature, respiratory rate, SpO₂, weight, height, automatic BMI) and observations.
- View today's queue by department and status.

### Dentist

- Dashboard of today's appointments, waiting patients, and follow-ups.
- Shared master patient record plus a dental-specific patient card.
- FDI permanent and primary tooth charts with per-tooth conditions, surfaces, diagnosis, planned and performed treatment, status, and notes.
- Clinical notes, diagnoses, treatment performed, medications, advice, and follow-up.
- Treatment plans with priority, estimated cost, status, and review dates.

### Eye Doctor

- Dashboard of today's optical appointments and follow-ups.
- Optical patient card with examination history and prescription history.
- Eye examination: presenting complaint, symptoms, unaided/pinhole/corrected visual acuity for each eye, external and segment examinations, intraocular pressure, colour vision, diagnosis, management plan, referral, and follow-up.
- Spectacle prescriptions (OD/OS sphere, cylinder, axis, add, prism, base, PD) with lens and frame recommendations.

### Administrator

- Staff accounts and role assignment (dentist, receptionist, eye doctor, administrator).
- Services, doctor schedules, blocked periods, and clinic settings.
- Reports: appointment volumes, status breakdowns, department activity, and revenue estimates.
- Notification log and delivery status.
- Audit log of security-relevant and clinical actions.

Administrators manage the clinic but are intentionally blocked from dental and optical clinical records.

---

## Architecture

```
app/                     Routes (public, auth, staff role areas)
  staff/dentist/         Dentist dashboard, appointments, patients, consultations, chart guide
  staff/optometrist/     Eye doctor dashboard, appointments, patients, consultations
  staff/receptionist/    Patients, appointments, queue
  staff/admin/           Staff, services, schedules, reports, audit, notifications, settings
components/              Public, auth, staff, and shared UI components
lib/
  data/queries.ts        All reusable read queries (Supabase)
  actions/               Server actions grouped by domain
  auth.ts                Supabase session + clinic role guards
  audit.ts               Audit logging
  notifications.ts       SMS (Africa's Talking) and email (Resend) delivery
  types.ts               Domain types and clinical constants
  supabase/             Browser, server and service-role Supabase clients
supabase/migrations/     PostgreSQL schema + RLS (0001-0003)
supabase/apply_all.sql   Combined copy of the migrations for the SQL Editor
supabase/seed.sql        Optional demo staff, settings, services, schedules
```

### Data model

- `staff` — authentication profile and clinic role.
- `patients` — shared master demographic record.
- `appointments` — bookings with doctor, service, schedule slot, and workflow status.
- `visits` — a patient's journey through a department on a given day.
- `vitals` — triage measurements recorded by reception.
- `dental_visits`, `tooth_findings`, `treatment_plans` — dental clinical records.
- `optical_visits`, `optical_prescriptions` — optical clinical records.
- `services`, `doctor_schedules`, `blocked_periods`, `clinic_settings` — configuration.
- `notifications`, `audit_logs`, `password_reset_tokens` — operations and security.

Dental and optical records share the patient identity but stay in separate clinical tables, so each department has its own history without duplicating demographics.

---

## Security model

- **Server-side authorisation on every request.** Pages use `requireRole(...)`; server actions use `requireStaffApi(...)`. Hiding a link is never the access control.
- **Assigned role verification.** The login form's role selector is only a convenience check. The authoritative role comes from the `staff` row; a mismatch is rejected and logged as `auth.role_mismatch`.
- **Supabase Auth sessions** stored in `httpOnly`, `sameSite=lax` cookies (`secure` in production) and refreshed by the proxy on each request. Deactivated accounts are rejected because the `staff` profile is re-read on every request.
- **Password handling** is delegated to Supabase Auth. Reset links use the `/auth/confirm` route and require an active `staff` profile before the password can be changed.
- **Least privilege.** Reception cannot open clinical records. Dentists and eye doctors only see their own department's clinical data and can only edit records they created. Administrators cannot read clinical notes.
- **Audit logging.** Sign-in, role mismatches, patient changes, appointment changes, clinical edits, prescriptions, staff changes, and settings changes are recorded with actor, role, entity, patient, and timestamp.
- **Input validation** with Zod and explicit length/range checks in server actions.
- **Double-booking prevention** with overlap checks plus a database-level partial unique index.
- **Privacy.** The public privacy notice covers lawful basis, data minimisation, retention, patient rights, and contact details under the Kenya Data Protection Act, 2019.

### Supabase setup

The app uses Supabase for both PostgreSQL and Auth. `supabase/migrations/0001_schema.sql` creates the schema, `0002_rls.sql` enables RLS with helper functions and policies, and `0003_supabase_app_rpcs.sql` adds the narrowly-scoped public/admin RPCs used by the app.

1. Open your project's **SQL Editor**.
2. Paste the whole of `supabase/apply_all.sql` and run it once.
3. Optional demo data: paste and run `supabase/seed.sql`. This creates the demo accounts listed above.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
5. Visit `/supabase-test` to confirm the tables are visible.

To add a real staff member: create the user in **Authentication → Users**, then insert a matching row in `public.staff` with the same `id` and the correct `role`. Alternatively, set `SUPABASE_SERVICE_ROLE_KEY` and use **Admin → Staff** in the app.

Security model:

- Staff read their own profile; only admins manage staff.
- Reception/admin manage patients, appointments, visits, and vitals.
- Dentists read shared dental history but write only their own records.
- Eye doctors have the equivalent optical boundary.
- Admins read audit logs; audit rows are append-only.
- Public (anon) has no direct table access; booking and lookup use the SECURITY DEFINER RPCs in `0003`.
- A trigger stops clinicians from rescheduling or reassigning appointments.

---

## Notifications

`lib/notifications.ts` sends SMS through Africa's Talking and email through Resend when the relevant environment variables are set. Without credentials it records the notification with status `not_configured` so the attempt is still visible in the admin notification log. Configure:

```
AFRICASTALKING_API_KEY
AFRICASTALKING_USERNAME
AFRICASTALKING_SENDER_ID
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL
```

---

## Verification

The production build passes with `npm run build`. The following workflows are intended for manual verification:

1. Public booking, lookup with correct and incorrect identity details, and cancellation.
2. Double-booking the same doctor/date/time is rejected.
3. Login with the wrong selected role is rejected; deactivated accounts cannot sign in.
4. A dentist cannot open reception or admin routes, and vice versa.
5. Reception registration, check-in, queue movement, and vitals/BMI.
6. Dental consultation, FDI chart findings, treatment plan, and completion.
7. Optical examination, spectacle prescription, and prescription history.
8. Admin staff creation/deactivation, service and schedule changes, reports, and audit entries.

---

## Production checklist

- [ ] Do not run `supabase/seed.sql` against production; create real staff through Supabase Auth or the admin UI.
- [ ] Set the correct `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SUPABASE_*` values.
- [ ] Apply all migrations in `supabase/migrations` (0001–0004).
- [ ] Configure SMS and email providers and verify sender IDs.
- [ ] Serve over HTTPS so auth cookies are marked `secure`.
- [ ] Back up the database and define a retention schedule.
- [ ] Review the privacy notice with the clinic's data protection officer.
- [ ] Register as a data controller/processor with the ODPC where required.
- [ ] Add rate limiting at the edge for `/login`, `/book`, and `/appointment`.
- [ ] Run an accessibility and penetration test before go-live.
