import "server-only";
import { db } from "../db";
import type {
  Appointment,
  AppointmentStatus,
  AuditLog,
  DentalVisit,
  Department,
  OpticalPrescription,
  OpticalVisit,
  Patient,
  Service,
  StaffUser,
  ToothFinding,
  TreatmentPlan,
  Visit,
  Vitals,
} from "../types";
import { addMinutesToTime, clinicToday, minutesFromTime, timeSlots, weekdayNumber } from "../utils";

const appointmentSelect = `
  SELECT a.*, s.name AS doctor_name, sv.name AS service_name, p.patient_number
  FROM appointments a
  JOIN staff s ON s.id = a.doctor_id
  LEFT JOIN services sv ON sv.id = a.service_id
  LEFT JOIN patients p ON p.id = a.patient_id
`;

export function getDoctors(department?: Department) {
  const role = department === "dental" ? "dentist" : department === "optical" ? "eye_doctor" : null;
  return db
    .prepare(
      `SELECT id, name, email, role, title, active, created_at FROM staff
       WHERE active = 1 ${role ? "AND role = ?" : "AND role IN ('dentist','eye_doctor')"}
       ORDER BY name`,
    )
    .all(...(role ? [role] : [])) as StaffUser[];
}

export function getServices(department?: Department, activeOnly = true) {
  return db
    .prepare(
      `SELECT * FROM services
       WHERE 1 = 1 ${department ? "AND department = ?" : ""} ${activeOnly ? "AND active = 1" : ""}
       ORDER BY department, name`,
    )
    .all(...(department ? [department] : [])) as Service[];
}

export function getPatient(id: string) {
  return db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Patient | undefined;
}

export function getPatientByNumber(patientNumber: string) {
  return db.prepare("SELECT * FROM patients WHERE patient_number = ?").get(patientNumber) as Patient | undefined;
}

export function searchPatients(query: string) {
  const term = `%${query.trim()}%`;
  return db
    .prepare(`
      SELECT * FROM patients
      WHERE full_name LIKE ? OR phone LIKE ? OR patient_number LIKE ?
      ORDER BY full_name
      LIMIT 40
    `)
    .all(term, term, term) as Patient[];
}

export function listPatients(limit = 50) {
  return db.prepare("SELECT * FROM patients ORDER BY created_at DESC LIMIT ?").all(limit) as Patient[];
}

export function listPatientsForDepartment(department: Department, query = "", limit = 100) {
  const term = `%${query.trim()}%`;
  return db
    .prepare(`
      SELECT DISTINCT p.* FROM patients p
      WHERE (
        EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.department = ?)
        OR EXISTS (SELECT 1 FROM visits v WHERE v.patient_id = p.id AND v.department = ?)
      )
      ${query.trim() ? "AND (p.full_name LIKE ? OR p.phone LIKE ? OR p.patient_number LIKE ?)" : ""}
      ORDER BY p.full_name
      LIMIT ?
    `)
    .all(
      ...(query.trim() ? [department, department, term, term, term, limit] : [department, department, limit]),
    ) as Patient[];
}

export function getPatientByExactIdentity(fullName: string, phone: string, dob: string | null) {
  const rows = db
    .prepare(`
      SELECT * FROM patients
      WHERE lower(full_name) = lower(?) AND phone = ? ${dob ? "AND date_of_birth = ?" : ""}
    `)
    .all(...(dob ? [fullName, phone, dob] : [fullName, phone])) as Patient[];
  return rows;
}

export function getAppointments(filters: {
  date?: string;
  fromDate?: string;
  department?: Department;
  doctorId?: string;
  status?: AppointmentStatus;
  query?: string;
  limit?: number;
}) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.date) {
    clauses.push("a.appointment_date = ?");
    params.push(filters.date);
  }
  if (filters.fromDate) {
    clauses.push("a.appointment_date >= ?");
    params.push(filters.fromDate);
  }
  if (filters.department) {
    clauses.push("a.department = ?");
    params.push(filters.department);
  }
  if (filters.doctorId) {
    clauses.push("a.doctor_id = ?");
    params.push(filters.doctorId);
  }
  if (filters.status) {
    clauses.push("a.status = ?");
    params.push(filters.status);
  }
  if (filters.query) {
    clauses.push("(a.full_name LIKE ? OR a.phone LIKE ? OR a.reference LIKE ?)");
    const term = `%${filters.query}%`;
    params.push(term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filters.limit ?? 200;
  return db
    .prepare(`${appointmentSelect} ${where} ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT ?`)
    .all(...params, limit) as Appointment[];
}

export function getAppointment(id: string) {
  return db.prepare(`${appointmentSelect} WHERE a.id = ?`).get(id) as Appointment | undefined;
}

export function getAppointmentsForPatient(patientId: string) {
  return db
    .prepare(`${appointmentSelect} WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`)
    .all(patientId) as Appointment[];
}

export function getUpcomingAppointmentsForPatient(patientId: string) {
  return db
    .prepare(`
      ${appointmentSelect}
      WHERE a.patient_id = ? AND a.appointment_date >= ? AND a.status NOT IN ('Cancelled','No Show','Completed')
      ORDER BY a.appointment_date ASC, a.appointment_time ASC
    `)
    .all(patientId, clinicToday()) as Appointment[];
}

export function getDentalVisit(id: string) {
  return db
    .prepare(`
      SELECT dv.*, s.name AS doctor_name
      FROM dental_visits dv LEFT JOIN staff s ON s.id = dv.doctor_id
      WHERE dv.id = ?
    `)
    .get(id) as DentalVisit | undefined;
}

export function getDentalVisitForAppointment(appointmentId: string) {
  return db
    .prepare(`
      SELECT dv.*, s.name AS doctor_name
      FROM dental_visits dv
      JOIN visits v ON v.id = dv.visit_id
      LEFT JOIN staff s ON s.id = dv.doctor_id
      WHERE v.appointment_id = ?
      ORDER BY dv.created_at DESC LIMIT 1
    `)
    .get(appointmentId) as DentalVisit | undefined;
}

export function getOpticalVisit(id: string) {
  return db
    .prepare(`
      SELECT ov.*, s.name AS doctor_name
      FROM optical_visits ov LEFT JOIN staff s ON s.id = ov.doctor_id
      WHERE ov.id = ?
    `)
    .get(id) as OpticalVisit | undefined;
}

export function getOpticalVisitForAppointment(appointmentId: string) {
  return db
    .prepare(`
      SELECT ov.*, s.name AS doctor_name
      FROM optical_visits ov
      JOIN visits v ON v.id = ov.visit_id
      LEFT JOIN staff s ON s.id = ov.doctor_id
      WHERE v.appointment_id = ?
      ORDER BY ov.created_at DESC LIMIT 1
    `)
    .get(appointmentId) as OpticalVisit | undefined;
}

export function getTreatmentPlan(id: string) {
  return db.prepare("SELECT * FROM treatment_plans WHERE id = ?").get(id) as TreatmentPlan | undefined;
}

export function getToothFinding(id: string) {
  return db.prepare("SELECT * FROM tooth_findings WHERE id = ?").get(id) as ToothFinding | undefined;
}

export function getOpticalPrescription(id: string) {
  return db
    .prepare(`
      SELECT op.*, s.name AS doctor_name
      FROM optical_prescriptions op LEFT JOIN staff s ON s.id = op.doctor_id
      WHERE op.id = ?
    `)
    .get(id) as OpticalPrescription | undefined;
}

export function getPatientAppointmentCount(patientId: string) {
  const row = db
    .prepare("SELECT COUNT(*) AS count, MAX(appointment_date) AS last_date FROM appointments WHERE patient_id = ?")
    .get(patientId) as { count: number; last_date: string | null };
  return row;
}

export function getAppointmentByReference(reference: string) {
  return db.prepare(`${appointmentSelect} WHERE a.reference = ?`).get(reference) as Appointment | undefined;
}

export function getTodayAppointments(options: { doctorId?: string; department?: Department } = {}) {
  return getAppointments({ date: clinicToday(), ...options });
}

export function getDashboardCounts(date: string, options: { doctorId?: string; department?: Department } = {}) {
  const params: unknown[] = [date];
  let extra = "";
  if (options.doctorId) {
    extra += " AND doctor_id = ?";
    params.push(options.doctorId);
  }
  if (options.department) {
    extra += " AND department = ?";
    params.push(options.department);
  }
  const rows = db
    .prepare(`SELECT status, COUNT(*) AS count FROM appointments WHERE appointment_date = ? ${extra} GROUP BY status`)
    .all(...params) as { status: AppointmentStatus; count: number }[];
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count])) as Record<string, number>;
  return {
    total: rows.reduce((sum, r) => sum + r.count, 0),
    booked: byStatus.Booked ?? 0,
    confirmed: byStatus.Confirmed ?? 0,
    checkedIn: byStatus["Checked In"] ?? 0,
    waiting: byStatus["Waiting for Doctor"] ?? 0,
    inConsultation: byStatus["In Consultation"] ?? 0,
    completed: byStatus.Completed ?? 0,
    cancelled: byStatus.Cancelled ?? 0,
    noShow: byStatus["No Show"] ?? 0,
    byStatus,
  };
}

export function getWaitingPatients(department: Department, doctorId?: string) {
  return db
    .prepare(`
      SELECT a.*, s.name AS doctor_name, sv.name AS service_name, p.patient_number,
             v.id AS visit_id, v.started_at AS visit_started_at
      FROM appointments a
      JOIN staff s ON s.id = a.doctor_id
      LEFT JOIN services sv ON sv.id = a.service_id
      LEFT JOIN patients p ON p.id = a.patient_id
      LEFT JOIN visits v ON v.appointment_id = a.id
      WHERE a.department = ? AND a.appointment_date = ?
        AND a.status IN ('Checked In','Waiting for Doctor')
        ${doctorId ? "AND a.doctor_id = ?" : ""}
      ORDER BY a.appointment_time
    `)
    .all(...(doctorId ? [department, clinicToday(), doctorId] : [department, clinicToday()])) as (Appointment & {
    visit_id: string | null;
    visit_started_at: string | null;
  })[];
}

export function getInConsultation(department: Department, doctorId?: string) {
  return db
    .prepare(`
      SELECT a.*, s.name AS doctor_name, sv.name AS service_name, p.patient_number
      FROM appointments a
      JOIN staff s ON s.id = a.doctor_id
      LEFT JOIN services sv ON sv.id = a.service_id
      LEFT JOIN patients p ON p.id = a.patient_id
      WHERE a.department = ? AND a.appointment_date = ? AND a.status = 'In Consultation'
      ${doctorId ? "AND a.doctor_id = ?" : ""}
      ORDER BY a.appointment_time
    `)
    .all(...(doctorId ? [department, clinicToday(), doctorId] : [department, clinicToday()])) as Appointment[];
}

export function getRecentPatients(actorId: string, department: Department, limit = 5) {
  return db
    .prepare(`
      SELECT DISTINCT p.*, MAX(al.created_at) AS last_viewed
      FROM audit_logs al
      JOIN patients p ON p.id = al.patient_id
      WHERE al.actor_id = ? AND al.action = 'patient.view' AND al.entity_type = ?
      GROUP BY p.id
      ORDER BY last_viewed DESC
      LIMIT ?
    `)
    .all(actorId, department === "dental" ? "dental_record" : "optical_record", limit) as (Patient & {
    last_viewed: string;
  })[];
}

export function getVisitsForPatient(patientId: string) {
  return db
    .prepare(`
      SELECT v.*, s.name AS doctor_name
      FROM visits v LEFT JOIN staff s ON s.id = v.doctor_id
      WHERE v.patient_id = ? ORDER BY v.created_at DESC
    `)
    .all(patientId) as (Visit & { doctor_name: string | null })[];
}

export function getActiveVisit(patientId: string, department: Department) {
  return db
    .prepare(`
      SELECT v.*, s.name AS doctor_name
      FROM visits v LEFT JOIN staff s ON s.id = v.doctor_id
      WHERE v.patient_id = ? AND v.department = ? AND v.status IN ('Waiting','In Consultation')
      ORDER BY v.created_at DESC LIMIT 1
    `)
    .get(patientId, department) as (Visit & { doctor_name: string | null }) | undefined;
}

export function getVisit(id: string) {
  return db
    .prepare(`
      SELECT v.*, s.name AS doctor_name
      FROM visits v LEFT JOIN staff s ON s.id = v.doctor_id
      WHERE v.id = ?
    `)
    .get(id) as (Visit & { doctor_name: string | null }) | undefined;
}

export function getAppointmentForVisit(visitId: string) {
  return db
    .prepare(`
      ${appointmentSelect}
      JOIN visits v ON v.appointment_id = a.id
      WHERE v.id = ?
    `)
    .get(visitId) as Appointment | undefined;
}

export function getVitalsForPatient(patientId: string) {
  return db
    .prepare(`
      SELECT vi.*, s.name AS recorded_by_name
      FROM vitals vi LEFT JOIN staff s ON s.id = vi.recorded_by
      WHERE vi.patient_id = ? ORDER BY vi.recorded_at DESC
    `)
    .all(patientId) as Vitals[];
}

export function getLatestVitals(patientId: string) {
  return db
    .prepare(`
      SELECT vi.*, s.name AS recorded_by_name
      FROM vitals vi LEFT JOIN staff s ON s.id = vi.recorded_by
      WHERE vi.patient_id = ? ORDER BY vi.recorded_at DESC LIMIT 1
    `)
    .get(patientId) as Vitals | undefined;
}

export function getDentalVisits(patientId: string) {
  return db
    .prepare(`
      SELECT dv.*, s.name AS doctor_name
      FROM dental_visits dv LEFT JOIN staff s ON s.id = dv.doctor_id
      WHERE dv.patient_id = ? ORDER BY dv.visit_date DESC, dv.created_at DESC
    `)
    .all(patientId) as DentalVisit[];
}

export function getToothFindings(patientId: string, dentalVisitId?: string) {
  return db
    .prepare(`
      SELECT * FROM tooth_findings
      WHERE patient_id = ? ${dentalVisitId ? "AND dental_visit_id = ?" : ""}
      ORDER BY dental_visit_id DESC, tooth_number
    `)
    .all(...(dentalVisitId ? [patientId, dentalVisitId] : [patientId])) as ToothFinding[];
}

export function getTreatmentPlans(patientId: string) {
  return db
    .prepare("SELECT * FROM treatment_plans WHERE patient_id = ? ORDER BY created_at DESC")
    .all(patientId) as TreatmentPlan[];
}

export function getOpticalVisits(patientId: string) {
  return db
    .prepare(`
      SELECT ov.*, s.name AS doctor_name
      FROM optical_visits ov LEFT JOIN staff s ON s.id = ov.doctor_id
      WHERE ov.patient_id = ? ORDER BY ov.visit_date DESC, ov.created_at DESC
    `)
    .all(patientId) as OpticalVisit[];
}

export function getOpticalPrescriptions(patientId: string) {
  return db
    .prepare(`
      SELECT op.*, s.name AS doctor_name
      FROM optical_prescriptions op LEFT JOIN staff s ON s.id = op.doctor_id
      WHERE op.patient_id = ? ORDER BY op.prescribed_at DESC
    `)
    .all(patientId) as OpticalPrescription[];
}

export function getDoctorSchedule(doctorId: string, date: string) {
  return db
    .prepare("SELECT * FROM doctor_schedules WHERE doctor_id = ? AND weekday = ? AND active = 1")
    .get(doctorId, weekdayNumber(date)) as
    | {
        id: string;
        doctor_id: string;
        weekday: number;
        start_time: string;
        end_time: string;
        break_start: string | null;
        break_end: string | null;
        slot_minutes: number;
        active: number;
      }
    | undefined;
}

export function getAvailableSlots(doctorId: string, date: string, duration = 30) {
  const schedule = getDoctorSchedule(doctorId, date);
  if (!schedule) return [];
  const candidates = timeSlots(
    schedule.start_time,
    schedule.end_time,
    duration,
    schedule.break_start,
    schedule.break_end,
  );
  const existing = db
    .prepare(`
      SELECT appointment_time, duration_minutes FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled','No Show')
    `)
    .all(doctorId, date) as { appointment_time: string; duration_minutes: number }[];

  const blocked = db
    .prepare("SELECT start_at, end_at FROM blocked_periods WHERE doctor_id = ? AND date(start_at) <= ? AND date(end_at) >= ?")
    .all(doctorId, date, date) as { start_at: string; end_at: string }[];

  return candidates.map((slot) => {
    const start = minutesFromTime(slot);
    const end = start + duration;
    const overlaps = existing.some((a) => {
      const aStart = minutesFromTime(a.appointment_time);
      const aEnd = aStart + a.duration_minutes;
      return start < aEnd && end > aStart;
    });
    const isBlocked = blocked.some((b) => {
      const bStart = new Date(b.start_at).getTime();
      const bEnd = new Date(b.end_at).getTime();
      const slotStart = new Date(`${date}T${slot}:00`).getTime();
      const slotEnd = new Date(`${date}T${addMinutesToTime(slot, duration)}:00`).getTime();
      return slotStart < bEnd && slotEnd > bStart;
    });
    return { time: slot, available: !overlaps && !isBlocked };
  });
}

export function hasAppointmentOverlap(doctorId: string, date: string, time: string, duration: number, excludeId?: string) {
  const start = minutesFromTime(time);
  const end = start + duration;
  const rows = db
    .prepare(`
      SELECT id, appointment_time, duration_minutes FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled','No Show')
      ${excludeId ? "AND id <> ?" : ""}
    `)
    .all(...(excludeId ? [doctorId, date, excludeId] : [doctorId, date])) as {
    id: string;
    appointment_time: string;
    duration_minutes: number;
  }[];
  return rows.some((a) => {
    const aStart = minutesFromTime(a.appointment_time);
    const aEnd = aStart + a.duration_minutes;
    return start < aEnd && end > aStart;
  });
}

export function getStaffList() {
  return db
    .prepare("SELECT id, name, email, role, title, active, created_at FROM staff ORDER BY role, name")
    .all() as StaffUser[];
}

export function getStaff(id: string) {
  return db.prepare("SELECT * FROM staff WHERE id = ?").get(id) as (StaffUser & { password_hash: string }) | undefined;
}

export function getAuditLogs(limit = 100) {
  return db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit) as AuditLog[];
}

export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM clinic_settings ORDER BY key").all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}

export function setSetting(key: string, value: string) {
  db.prepare(`
    INSERT INTO clinic_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value);
}

export function getSchedules() {
  return db
    .prepare(`
      SELECT ds.*, s.name AS doctor_name
      FROM doctor_schedules ds JOIN staff s ON s.id = ds.doctor_id
      ORDER BY s.name, ds.weekday
    `)
    .all() as {
    id: string;
    doctor_id: string;
    doctor_name: string;
    weekday: number;
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
    slot_minutes: number;
    active: number;
  }[];
}

export function getReports(date: string) {
  const daily = db
    .prepare(`
      SELECT department, status, COUNT(*) AS count
      FROM appointments WHERE appointment_date = ?
      GROUP BY department, status ORDER BY department, status
    `)
    .all(date) as { department: Department; status: AppointmentStatus; count: number }[];

  const registrations = db
    .prepare("SELECT COUNT(*) AS count FROM patients WHERE date(created_at) = ?")
    .get(date) as { count: number };
  const registrationsMonth = db
    .prepare("SELECT COUNT(*) AS count FROM patients WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', ?)")
    .get(date) as { count: number };

  const dentalCompleted = db
    .prepare("SELECT COUNT(*) AS count FROM dental_visits WHERE visit_date = ?")
    .get(date) as { count: number };
  const opticalCompleted = db
    .prepare("SELECT COUNT(*) AS count FROM optical_visits WHERE visit_date = ?")
    .get(date) as { count: number };

  const dentalFollowUps = db
    .prepare("SELECT COUNT(*) AS count FROM treatment_plans WHERE next_review_date IS NOT NULL AND next_review_date <= ? AND status IN ('Planned','In Progress')")
    .get(date) as { count: number };
  const opticalFollowUps = db
    .prepare("SELECT COUNT(*) AS count FROM optical_visits WHERE follow_up_date IS NOT NULL AND follow_up_date <= ?")
    .get(date) as { count: number };

  const waiting = db
    .prepare(`
      SELECT ROUND(AVG((julianday(v.started_at) - julianday(a.checked_in_at)) * 24 * 60)) AS minutes
      FROM visits v JOIN appointments a ON a.id = v.appointment_id
      WHERE v.started_at IS NOT NULL AND a.checked_in_at IS NOT NULL AND a.appointment_date = ?
    `)
    .get(date) as { minutes: number | null };

  const cancellations = db
    .prepare("SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ? AND status = 'Cancelled'")
    .get(date) as { count: number };
  const noShows = db
    .prepare("SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ? AND status = 'No Show'")
    .get(date) as { count: number };

  return {
    daily,
    registrations: registrations.count,
    registrationsMonth: registrationsMonth.count,
    dentalCompleted: dentalCompleted.count,
    opticalCompleted: opticalCompleted.count,
    followUpsDue: dentalFollowUps.count + opticalFollowUps.count,
    averageWaitMinutes: waiting.minutes,
    cancellations: cancellations.count,
    noShows: noShows.count,
  };
}

export function getNotificationRows(limit = 40) {
  return db
    .prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?")
    .all(limit) as {
    id: string;
    appointment_id: string | null;
    channel: string;
    recipient: string;
    template: string;
    status: string;
    payload: string | null;
    error: string | null;
    sent_at: string | null;
    created_at: string;
  }[];
}

export function getNotificationsForAppointment(appointmentId: string) {
  return db
    .prepare("SELECT * FROM notifications WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(appointmentId) as {
    id: string;
    channel: string;
    recipient: string;
    template: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    created_at: string;
  }[];
}

export function getAuditForEntity(entityType: string, entityId: string, limit = 20) {
  return db
    .prepare("SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(entityType, entityId, limit) as AuditLog[];
}

export function getAdminOverview(date: string) {
  const staff = db
    .prepare("SELECT role, COUNT(*) AS count, SUM(active) AS active FROM staff GROUP BY role")
    .all() as { role: string; count: number; active: number }[];
  const patients = db.prepare("SELECT COUNT(*) AS count FROM patients").get() as { count: number };
  const newPatients = db
    .prepare("SELECT COUNT(*) AS count FROM patients WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', ?)")
    .get(date) as { count: number };
  const appointments = db
    .prepare("SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ?")
    .get(date) as { count: number };
  const failedNotifications = db
    .prepare("SELECT COUNT(*) AS count FROM notifications WHERE status = 'failed'")
    .get() as { count: number };
  const pendingFollowUps = db
    .prepare("SELECT COUNT(*) AS count FROM treatment_plans WHERE status IN ('Planned','In Progress') AND next_review_date IS NOT NULL AND next_review_date <= ?")
    .get(date) as { count: number };
  return {
    staff,
    staffTotal: staff.reduce((sum, row) => sum + row.count, 0),
    staffActive: staff.reduce((sum, row) => sum + (row.active ?? 0), 0),
    patients: patients.count,
    newPatients: newPatients.count,
    appointments: appointments.count,
    failedNotifications: failedNotifications.count,
    pendingFollowUps: pendingFollowUps.count,
  };
}

export function getAppointmentTrend(days = 7) {
  return db
    .prepare(`
      SELECT appointment_date AS date, COUNT(*) AS count,
             SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
             SUM(CASE WHEN status IN ('Cancelled','No Show') THEN 1 ELSE 0 END) AS missed
      FROM appointments
      WHERE appointment_date >= date('now', ?)
      GROUP BY appointment_date ORDER BY appointment_date
    `)
    .all(`-${days - 1} days`) as { date: string; count: number; completed: number; missed: number }[];
}

export function getFollowUpsDue(department?: Department) {
  if (department === "dental") {
    return db
      .prepare(`
        SELECT tp.*, p.full_name, p.patient_number, p.phone
        FROM treatment_plans tp JOIN patients p ON p.id = tp.patient_id
        WHERE tp.next_review_date IS NOT NULL AND tp.next_review_date <= ? AND tp.status IN ('Planned','In Progress')
        ORDER BY tp.next_review_date
      `)
      .all(clinicToday());
  }
  if (department === "optical") {
    return db
      .prepare(`
        SELECT ov.*, p.full_name, p.patient_number, p.phone
        FROM optical_visits ov JOIN patients p ON p.id = ov.patient_id
        WHERE ov.follow_up_date IS NOT NULL AND ov.follow_up_date <= ?
        ORDER BY ov.follow_up_date
      `)
      .all(clinicToday());
  }
  return db
    .prepare(`
      SELECT tp.*, p.full_name, p.patient_number, p.phone, 'dental' AS department
      FROM treatment_plans tp JOIN patients p ON p.id = tp.patient_id
      WHERE tp.next_review_date IS NOT NULL AND tp.next_review_date <= ? AND tp.status IN ('Planned','In Progress')
      UNION ALL
      SELECT ov.id, ov.patient_id, ov.visit_id, '' AS tooth_numbers, ov.diagnosis, 'Optical follow-up' AS procedure,
        'Medium' AS priority, NULL AS estimated_cost, 'Planned' AS status, ov.management_plan AS notes,
        ov.follow_up_date AS next_review_date, ov.doctor_id AS created_by, ov.created_at, ov.updated_at,
        p.full_name, p.patient_number, p.phone, 'optical' AS department
      FROM optical_visits ov JOIN patients p ON p.id = ov.patient_id
      WHERE ov.follow_up_date IS NOT NULL AND ov.follow_up_date <= ?
      ORDER BY next_review_date
    `)
    .all(clinicToday(), clinicToday());
}
