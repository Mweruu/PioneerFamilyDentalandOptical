# Pioneer Family Dental and Optical Clinic

A complete clinic management system for a combined dental and optical practice in Kenya. It covers public appointment booking, secure staff authentication with four roles, reception and triage, dental charting, eye examinations and spectacle prescriptions, administration, reporting, notifications, and audit logging.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**. The working demo uses a real local **SQLite** database through `better-sqlite3`; a **Supabase/PostgreSQL schema with Row Level Security** is included as the production deployment blueprint.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # set SESSION_SECRET before production
npm run dev                  # http://localhost:3000
npm run build                # production build
npm start                    # serve the production build
```

The database is created automatically at `data/clinic.db` on first run and seeded with demo staff, patients, appointments, clinical records, and schedules. Delete that file to reset the demo data.

Create `.env.local` from `.env.example` before deploying. At minimum set a strong `SESSION_SECRET` and the correct `NEXT_PUBLIC_APP_URL`. In production the app refuses to sign sessions if `SESSION_SECRET` is missing, so the demo fallback cannot leak into a live deployment.

### Demo accounts

These accounts are seeded for evaluation. **Remove them before production** (delete the seed block in `lib/db.ts` and provision real staff through Supabase Auth or the admin UI).

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@pioneerclinic.co.ke` | `Admin@12345` |
| Receptionist | `reception@pioneerclinic.co.ke` | `Reception@123` |
| Dentist | `dentist@pioneerclinic.co.ke` | `Dentist@123` |
| Dentist | `dentist2@pioneerclinic.co.ke` | `Dentist@123` |
| Eye Doctor | `optometrist@pioneerclinic.co.ke` | `Optical@123` |

Demo patients: `PFC-2026-0001` Mary Wambui, `PFC-2026-0002` Peter Mwangi, `PFC-2026-0003` Aisha Noor, `PFC-2026-0004` Daniel Kipchoge. Demo appointment references are `PF-DEMO-1001` to `PF-DEMO-1004`.

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
  db.ts                  SQLite schema, migrations, and demo seed
  data/queries.ts        All reusable read queries
  actions/               Server actions grouped by domain
  auth.ts                JWT cookie sessions, role guards, password hashing
  audit.ts               Audit logging
  notifications.ts       SMS (Africa's Talking) and email (Resend) delivery
  types.ts               Domain types and clinical constants
supabase/migrations/     PostgreSQL schema + RLS deployment blueprint
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
- **JWT session cookies** signed with HS256 (`jose`), `httpOnly`, `sameSite=lax`, `secure` in production, and an 8-hour expiry. Deactivated accounts are rejected on every request because the user is re-read from the database.
- **Password hashing** with bcrypt (cost 10). Password reset tokens are SHA-256 hashed at rest, expire after 30 minutes, and are single-use.
- **Least privilege.** Reception cannot open clinical records. Dentists and eye doctors only see their own department's clinical data and can only edit records they created. Administrators cannot read clinical notes.
- **Audit logging.** Sign-in, role mismatches, patient changes, appointment changes, clinical edits, prescriptions, staff changes, and settings changes are recorded with actor, role, entity, patient, and timestamp.
- **Input validation** with Zod and explicit length/range checks in server actions.
- **Double-booking prevention** with overlap checks plus a database-level partial unique index.
- **Privacy.** The public privacy notice covers lawful basis, data minimisation, retention, patient rights, and contact details under the Kenya Data Protection Act, 2019.

### Supabase blueprint

`supabase/migrations/0001_schema.sql` creates the PostgreSQL schema and `0002_rls.sql` enables RLS with helper functions and policies:

- Staff read their own profile; only admins manage staff.
- Reception/admin manage patients, appointments, visits, and vitals.
- Dentists read shared dental history but write only their own records.
- Eye doctors have the equivalent optical boundary.
- Admins read audit logs; audit rows are append-only.
- Public (anon) has no table access. Public booking and lookup run server-side with the service role after validation.
- A trigger stops clinicians from rescheduling or reassigning appointments.

To deploy: create a Supabase project, run `supabase db push`, create staff in Supabase Auth, then insert matching `public.staff` rows with the correct role. The current demo does not import a Supabase client because no project credentials were available; the local SQLite implementation is fully functional.

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

- [ ] Replace the demo seed and remove the demo account panel from `/login`.
- [ ] Set a strong, unique `SESSION_SECRET` and `NEXT_PUBLIC_APP_URL`.
- [ ] Move to Supabase Postgres/Auth and apply both migrations.
- [ ] Configure SMS and email providers and verify sender IDs.
- [ ] Serve over HTTPS so session cookies are marked `secure`.
- [ ] Back up the database and define a retention schedule.
- [ ] Review the privacy notice with the clinic's data protection officer.
- [ ] Register as a data controller/processor with the ODPC where required.
- [ ] Add rate limiting at the edge for `/login`, `/book`, and `/appointment`.
- [ ] Run an accessibility and penetration test before go-live.
