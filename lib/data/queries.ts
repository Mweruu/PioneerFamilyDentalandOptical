import "server-only";
import { createClient } from "../supabase/server";
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

type Row = Record<string, any>;

const appointmentSelect =
  "*, staff!appointments_doctor_id_fkey(name), services!appointments_service_id_fkey(name), patients!appointments_patient_id_fkey(patient_number)";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function boolInt(value: unknown) {
  return value ? 1 : 0;
}

function shortTime(value: unknown) {
  return typeof value === "string" ? value.slice(0, 5) : null;
}

function jsonText(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function mapStaff(row: Row): StaffUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    role: row.role,
    title: row.title ?? null,
    active: boolInt(row.active),
    created_at: row.created_at,
  };
}

function mapService(row: Row): Service {
  return {
    id: row.id,
    department: row.department,
    name: row.name,
    description: row.description ?? null,
    duration_minutes: row.duration_minutes,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    active: boolInt(row.active),
  };
}

function mapAppointment(row: Row): Appointment {
  return {
    id: row.id,
    reference: row.reference,
    patient_id: row.patient_id ?? null,
    patient_number: row.patients?.patient_number ?? null,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email ?? null,
    date_of_birth: row.date_of_birth ?? null,
    gender: row.gender ?? null,
    department: row.department,
    doctor_id: row.doctor_id,
    doctor_name: row.staff?.name ?? "Unknown clinician",
    service_id: row.service_id ?? null,
    service_name: row.services?.name ?? null,
    appointment_date: row.appointment_date,
    appointment_time: shortTime(row.appointment_time) ?? "",
    duration_minutes: row.duration_minutes,
    reason: row.reason,
    patient_type: row.patient_type,
    notes: row.notes ?? null,
    status: row.status,
    source: row.source,
    checked_in_at: row.checked_in_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapVisit(row: Row): Visit & { doctor_name: string | null } {
  return {
    id: row.id,
    patient_id: row.patient_id,
    appointment_id: row.appointment_id ?? null,
    department: row.department,
    doctor_id: row.doctor_id ?? null,
    status: row.status,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
    doctor_name: row.staff?.name ?? null,
  };
}

function mapVitals(row: Row): Vitals {
  return {
    id: row.id,
    patient_id: row.patient_id,
    visit_id: row.visit_id ?? null,
    bp_systolic: row.bp_systolic ?? null,
    bp_diastolic: row.bp_diastolic ?? null,
    pulse: row.pulse ?? null,
    temperature_c: row.temperature_c === null || row.temperature_c === undefined ? null : Number(row.temperature_c),
    respiratory_rate: row.respiratory_rate ?? null,
    spo2: row.spo2 ?? null,
    weight_kg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
    height_cm: row.height_cm === null || row.height_cm === undefined ? null : Number(row.height_cm),
    bmi: row.bmi === null || row.bmi === undefined ? null : Number(row.bmi),
    observations: row.observations ?? null,
    recorded_by: row.recorded_by,
    recorded_by_name: row.staff?.name ?? null,
    recorded_at: row.recorded_at,
  };
}

function mapDentalVisit(row: Row): DentalVisit {
  return {
    id: row.id,
    patient_id: row.patient_id,
    visit_id: row.visit_id ?? null,
    doctor_id: row.doctor_id,
    doctor_name: row.staff?.name ?? null,
    visit_date: row.visit_date,
    presenting_complaint: row.presenting_complaint ?? null,
    history: row.history ?? null,
    examination_findings: row.examination_findings ?? null,
    diagnosis: row.diagnosis ?? null,
    treatment_performed: row.treatment_performed ?? null,
    medications: row.medications ?? null,
    advice: row.advice ?? null,
    follow_up: row.follow_up ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapToothFinding(row: Row): ToothFinding {
  return {
    id: row.id,
    patient_id: row.patient_id,
    dental_visit_id: row.dental_visit_id,
    tooth_number: row.tooth_number,
    dentition: row.dentition,
    condition: row.condition,
    surfaces: jsonText(row.surfaces),
    diagnosis: row.diagnosis ?? null,
    planned_treatment: row.planned_treatment ?? null,
    treatment_performed: row.treatment_performed ?? null,
    treatment_date: row.treatment_date ?? null,
    notes: row.notes ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapTreatmentPlan(row: Row): TreatmentPlan {
  return {
    id: row.id,
    patient_id: row.patient_id,
    dental_visit_id: row.dental_visit_id ?? null,
    tooth_numbers: row.tooth_numbers,
    diagnosis: row.diagnosis,
    procedure: row.procedure,
    priority: row.priority,
    estimated_cost: row.estimated_cost === null || row.estimated_cost === undefined ? null : Number(row.estimated_cost),
    status: row.status,
    notes: row.notes ?? null,
    next_review_date: row.next_review_date ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapOpticalVisit(row: Row): OpticalVisit {
  return {
    id: row.id,
    patient_id: row.patient_id,
    visit_id: row.visit_id ?? null,
    doctor_id: row.doctor_id,
    doctor_name: row.staff?.name ?? null,
    visit_date: row.visit_date,
    presenting_complaint: row.presenting_complaint ?? null,
    symptoms: jsonText(row.symptoms),
    unaided_va_od: row.unaided_va_od ?? null,
    unaided_va_os: row.unaided_va_os ?? null,
    pinhole_va_od: row.pinhole_va_od ?? null,
    pinhole_va_os: row.pinhole_va_os ?? null,
    corrected_va_od: row.corrected_va_od ?? null,
    corrected_va_os: row.corrected_va_os ?? null,
    external_examination: row.external_examination ?? null,
    anterior_segment: row.anterior_segment ?? null,
    posterior_segment: row.posterior_segment ?? null,
    iop_od: row.iop_od ?? null,
    iop_os: row.iop_os ?? null,
    colour_vision: row.colour_vision ?? null,
    diagnosis: row.diagnosis ?? null,
    management_plan: row.management_plan ?? null,
    referral: row.referral ?? null,
    follow_up_date: row.follow_up_date ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPrescription(row: Row): OpticalPrescription {
  return {
    id: row.id,
    patient_id: row.patient_id,
    optical_visit_id: row.optical_visit_id ?? null,
    doctor_id: row.doctor_id,
    doctor_name: row.staff?.name ?? null,
    od_sph: row.od_sph ?? null,
    od_cyl: row.od_cyl ?? null,
    od_axis: row.od_axis ?? null,
    od_add: row.od_add ?? null,
    od_prism: row.od_prism ?? null,
    od_base: row.od_base ?? null,
    os_sph: row.os_sph ?? null,
    os_cyl: row.os_cyl ?? null,
    os_axis: row.os_axis ?? null,
    os_add: row.os_add ?? null,
    os_prism: row.os_prism ?? null,
    os_base: row.os_base ?? null,
    pd: row.pd ?? null,
    pd_od: row.pd_od ?? null,
    pd_os: row.pd_os ?? null,
    lens_type: row.lens_type ?? null,
    lens_recommendation: row.lens_recommendation ?? null,
    frame_recommendation: row.frame_recommendation ?? null,
    notes: row.notes ?? null,
    prescribed_at: row.prescribed_at,
    created_at: row.created_at,
  };
}

function mapNotification(row: Row) {
  return {
    id: row.id,
    appointment_id: row.appointment_id ?? null,
    channel: row.channel,
    recipient: row.recipient,
    template: row.template,
    status: row.status,
    payload: jsonText(row.payload),
    error: row.error ?? null,
    sent_at: row.sent_at ?? null,
    created_at: row.created_at,
  };
}

function searchTerm(value: string) {
  return value.trim().replace(/[%,()]/g, "");
}

export async function getDoctors(department?: Department) {
  const supabase = await createClient();
  let query = supabase
    .from("public_staff")
    .select("id, name, role, title, active, created_at")
    .eq("active", true);

  if (department) {
    query = query.eq("role", department === "dental" ? "dentist" : "eye_doctor");
  } else {
    query = query.in("role", ["dentist", "eye_doctor"]);
  }

  const { data, error } = await query.order("name");
  fail(error);
  return (data ?? []).map(mapStaff);
}

export async function getServices(department?: Department, activeOnly = true) {
  const supabase = await createClient();
  let query = supabase.from("services").select("*");
  if (department) query = query.eq("department", department);
  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query.order("department").order("name");
  fail(error);
  return (data ?? []).map(mapService);
}

export async function getPatient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  fail(error);
  return (data as Patient | null) ?? undefined;
}

export async function getPatientByNumber(patientNumber: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("patient_number", patientNumber)
    .maybeSingle();
  fail(error);
  return (data as Patient | null) ?? undefined;
}

export async function searchPatients(query: string) {
  const supabase = await createClient();
  const term = searchTerm(query);
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,patient_number.ilike.%${term}%`)
    .order("full_name")
    .limit(40);
  fail(error);
  return (data ?? []) as Patient[];
}

export async function listPatients(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []) as Patient[];
}

export async function listPatientsForDepartment(department: Department, query = "", limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_department_patients", {
    p_department: department,
    p_query: query.trim(),
    p_limit: limit,
  });
  fail(error);
  return (data ?? []) as Patient[];
}

export async function getPatientByExactIdentity(fullName: string, phone: string, dob: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("*")
    .ilike("full_name", fullName.trim())
    .eq("phone", phone);
  if (dob) query = query.eq("date_of_birth", dob);
  const { data, error } = await query;
  fail(error);
  return (data ?? []) as Patient[];
}

export async function getAppointments(filters: {
  date?: string;
  fromDate?: string;
  department?: Department;
  doctorId?: string;
  status?: AppointmentStatus;
  query?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let query = supabase.from("appointments").select(appointmentSelect);

  if (filters.date) query = query.eq("appointment_date", filters.date);
  if (filters.fromDate) query = query.gte("appointment_date", filters.fromDate);
  if (filters.department) query = query.eq("department", filters.department);
  if (filters.doctorId) query = query.eq("doctor_id", filters.doctorId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.query) {
    const term = searchTerm(filters.query);
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,reference.ilike.%${term}%`);
  }

  const { data, error } = await query
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(filters.limit ?? 200);
  fail(error);
  return (data ?? []).map(mapAppointment);
}

export async function getAppointment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data ? mapAppointment(data) : undefined;
}

export async function getAppointmentsForPatient(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("patient_id", patientId)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });
  fail(error);
  return (data ?? []).map(mapAppointment);
}

export async function getUpcomingAppointmentsForPatient(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("patient_id", patientId)
    .gte("appointment_date", clinicToday())
    .not("status", "in", "(Cancelled,No Show,Completed)")
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });
  fail(error);
  return (data ?? []).map(mapAppointment);
}

export async function getDentalVisit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dental_visits")
    .select("*, staff!dental_visits_doctor_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data ? mapDentalVisit(data) : undefined;
}

export async function getDentalVisitForAppointment(appointmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dental_visits")
    .select("*, staff!dental_visits_doctor_id_fkey(name), visits!inner(appointment_id)")
    .eq("visits.appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error);
  return data ? mapDentalVisit(data) : undefined;
}

export async function getOpticalVisit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("optical_visits")
    .select("*, staff!optical_visits_doctor_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data ? mapOpticalVisit(data) : undefined;
}

export async function getOpticalVisitForAppointment(appointmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("optical_visits")
    .select("*, staff!optical_visits_doctor_id_fkey(name), visits!inner(appointment_id)")
    .eq("visits.appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error);
  return data ? mapOpticalVisit(data) : undefined;
}

export async function getTreatmentPlan(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("treatment_plans").select("*").eq("id", id).maybeSingle();
  fail(error);
  return data ? mapTreatmentPlan(data) : undefined;
}

export async function getToothFinding(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tooth_findings").select("*").eq("id", id).maybeSingle();
  fail(error);
  return data ? mapToothFinding(data) : undefined;
}

export async function getOpticalPrescription(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("optical_prescriptions")
    .select("*, staff!optical_prescriptions_doctor_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data ? mapPrescription(data) : undefined;
}

export async function getPatientAppointmentCount(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("appointment_date")
    .eq("patient_id", patientId);
  fail(error);
  const rows = (data ?? []) as { appointment_date: string }[];
  return {
    count: rows.length,
    last_date: rows.reduce<string | null>(
      (latest, row) => (!latest || row.appointment_date > latest ? row.appointment_date : latest),
      null,
    ),
  };
}

export async function getAppointmentByReference(reference: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("reference", reference)
    .maybeSingle();
  fail(error);
  return data ? mapAppointment(data) : undefined;
}

export async function getTodayAppointments(options: { doctorId?: string; department?: Department } = {}) {
  return getAppointments({ date: clinicToday(), ...options });
}

export async function getDashboardCounts(
  date: string,
  options: { doctorId?: string; department?: Department } = {},
) {
  const supabase = await createClient();
  let query = supabase.from("appointments").select("status").eq("appointment_date", date);
  if (options.doctorId) query = query.eq("doctor_id", options.doctorId);
  if (options.department) query = query.eq("department", options.department);

  const { data, error } = await query;
  fail(error);

  const rows = (data ?? []) as { status: AppointmentStatus }[];
  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: rows.length,
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

export async function getWaitingPatients(department: Department, doctorId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(`${appointmentSelect}, visits(id, started_at)`)
    .eq("department", department)
    .eq("appointment_date", clinicToday())
    .in("status", ["Checked In", "Waiting for Doctor"]);
  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query.order("appointment_time");
  fail(error);

  return (data ?? []).map((row: Row) => {
    const appointment = mapAppointment(row);
    const visit = Array.isArray(row.visits) ? row.visits[0] : row.visits;
    return {
      ...appointment,
      visit_id: visit?.id ?? null,
      visit_started_at: visit?.started_at ?? null,
    };
  });
}

export async function getInConsultation(department: Department, doctorId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("department", department)
    .eq("appointment_date", clinicToday())
    .eq("status", "In Consultation");
  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query.order("appointment_time");
  fail(error);
  return (data ?? []).map(mapAppointment);
}

export async function getRecentPatients(actorId: string, department: Department, limit = 5) {
  const supabase = await createClient();
  const { data: logs, error: logError } = await supabase
    .from("audit_logs")
    .select("patient_id, created_at")
    .eq("actor_id", actorId)
    .eq("action", "patient.view")
    .eq("entity_type", department === "dental" ? "dental_record" : "optical_record")
    .not("patient_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * 4);
  fail(logError);

  const lastViewed = new Map<string, string>();
  for (const row of (logs ?? []) as { patient_id: string; created_at: string }[]) {
    if (!lastViewed.has(row.patient_id)) lastViewed.set(row.patient_id, row.created_at);
  }
  const ids = [...lastViewed.keys()].slice(0, limit);
  if (!ids.length) return [];

  const { data: patients, error } = await supabase.from("patients").select("*").in("id", ids);
  fail(error);

  return ((patients ?? []) as Patient[])
    .map((patient) => ({ ...patient, last_viewed: lastViewed.get(patient.id) ?? patient.created_at }))
    .sort((a, b) => b.last_viewed.localeCompare(a.last_viewed))
    .slice(0, limit);
}

export async function getVisitsForPatient(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*, staff!visits_doctor_id_fkey(name)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(mapVisit);
}

export async function getActiveVisit(patientId: string, department: Department) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*, staff!visits_doctor_id_fkey(name)")
    .eq("patient_id", patientId)
    .eq("department", department)
    .in("status", ["Waiting", "In Consultation"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error);
  return data ? mapVisit(data) : undefined;
}

export async function getVisit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*, staff!visits_doctor_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data ? mapVisit(data) : undefined;
}

export async function getAppointmentForVisit(visitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(`${appointmentSelect}, visits!inner(id)`)
    .eq("visits.id", visitId)
    .maybeSingle();
  fail(error);
  return data ? mapAppointment(data) : undefined;
}

export async function getVitalsForPatient(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vitals")
    .select("*, staff!vitals_recorded_by_fkey(name)")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false });
  fail(error);
  return (data ?? []).map(mapVitals);
}

export async function getLatestVitals(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vitals")
    .select("*, staff!vitals_recorded_by_fkey(name)")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error);
  return data ? mapVitals(data) : undefined;
}

export async function getDentalVisits(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dental_visits")
    .select("*, staff!dental_visits_doctor_id_fkey(name)")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(mapDentalVisit);
}

export async function getToothFindings(patientId: string, dentalVisitId?: string) {
  const supabase = await createClient();
  let query = supabase.from("tooth_findings").select("*").eq("patient_id", patientId);
  if (dentalVisitId) query = query.eq("dental_visit_id", dentalVisitId);

  const { data, error } = await query
    .order("dental_visit_id", { ascending: false })
    .order("tooth_number");
  fail(error);
  return (data ?? []).map(mapToothFinding);
}

export async function getTreatmentPlans(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_plans")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(mapTreatmentPlan);
}

export async function getOpticalVisits(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("optical_visits")
    .select("*, staff!optical_visits_doctor_id_fkey(name)")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(mapOpticalVisit);
}

export async function getOpticalPrescriptions(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("optical_prescriptions")
    .select("*, staff!optical_prescriptions_doctor_id_fkey(name)")
    .eq("patient_id", patientId)
    .order("prescribed_at", { ascending: false });
  fail(error);
  return (data ?? []).map(mapPrescription);
}

export async function getDoctorSchedule(doctorId: string, date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("weekday", weekdayNumber(date))
    .eq("active", true)
    .maybeSingle();
  fail(error);
  if (!data) return undefined;

  return {
    id: data.id,
    doctor_id: data.doctor_id,
    weekday: data.weekday,
    start_time: shortTime(data.start_time) ?? "",
    end_time: shortTime(data.end_time) ?? "",
    break_start: shortTime(data.break_start),
    break_end: shortTime(data.break_end),
    slot_minutes: data.slot_minutes,
    active: boolInt(data.active),
  };
}

export async function getAvailableSlots(doctorId: string, date: string, duration = 30) {
  const schedule = await getDoctorSchedule(doctorId, date);
  if (!schedule) return [];

  const candidates = timeSlots(
    schedule.start_time,
    schedule.end_time,
    duration,
    schedule.break_start,
    schedule.break_end,
  );

  const supabase = await createClient();
  const [{ data: existing, error: appointmentError }, { data: blocked, error: blockedError }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("appointment_time, duration_minutes")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", date)
        .not("status", "in", "(Cancelled,No Show)"),
      supabase
        .from("blocked_periods")
        .select("start_at, end_at")
        .eq("doctor_id", doctorId)
        .lte("start_at", `${date}T23:59:59+03:00`)
        .gte("end_at", `${date}T00:00:00+03:00`),
    ]);
  fail(appointmentError);
  fail(blockedError);

  const appointments = (existing ?? []) as { appointment_time: string; duration_minutes: number }[];
  const periods = (blocked ?? []) as { start_at: string; end_at: string }[];

  return candidates.map((slot) => {
    const start = minutesFromTime(slot);
    const end = start + duration;
    const overlaps = appointments.some((appointment) => {
      const appointmentStart = minutesFromTime(shortTime(appointment.appointment_time) ?? "00:00");
      const appointmentEnd = appointmentStart + appointment.duration_minutes;
      return start < appointmentEnd && end > appointmentStart;
    });
    const isBlocked = periods.some((period) => {
      const periodStart = new Date(period.start_at).getTime();
      const periodEnd = new Date(period.end_at).getTime();
      const slotStart = new Date(`${date}T${slot}:00+03:00`).getTime();
      const slotEnd = new Date(`${date}T${addMinutesToTime(slot, duration)}:00+03:00`).getTime();
      return slotStart < periodEnd && slotEnd > periodStart;
    });
    return { time: slot, available: !overlaps && !isBlocked };
  });
}

export async function hasAppointmentOverlap(
  doctorId: string,
  date: string,
  time: string,
  duration: number,
  excludeId?: string,
) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id, appointment_time, duration_minutes")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date)
    .not("status", "in", "(Cancelled,No Show)");
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  fail(error);

  const start = minutesFromTime(time);
  const end = start + duration;
  return ((data ?? []) as { appointment_time: string; duration_minutes: number }[]).some((appointment) => {
    const appointmentStart = minutesFromTime(shortTime(appointment.appointment_time) ?? "00:00");
    const appointmentEnd = appointmentStart + appointment.duration_minutes;
    return start < appointmentEnd && end > appointmentStart;
  });
}

export async function getStaffList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, email, role, title, active, created_at")
    .order("role")
    .order("name");
  fail(error);
  return (data ?? []).map(mapStaff);
}

export async function getStaff(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, email, role, title, active, created_at")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data ? mapStaff(data) : undefined;
}

export async function getAuditLogs(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []) as AuditLog[];
}

export async function getSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clinic_settings").select("key, value").order("key");
  fail(error);
  return Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((row) => [row.key, row.value]));
}

export async function setSetting(key: string, value: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("clinic_settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  fail(error);
}

export async function getSchedules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("*, staff!doctor_schedules_doctor_id_fkey(name)");
  fail(error);

  return ((data ?? []) as Row[])
    .map((row) => ({
      id: row.id,
      doctor_id: row.doctor_id,
      doctor_name: row.staff?.name ?? "Unknown clinician",
      weekday: row.weekday,
      start_time: shortTime(row.start_time) ?? "",
      end_time: shortTime(row.end_time) ?? "",
      break_start: shortTime(row.break_start),
      break_end: shortTime(row.break_end),
      slot_minutes: row.slot_minutes,
      active: boolInt(row.active),
    }))
    .sort((a, b) => a.doctor_name.localeCompare(b.doctor_name) || a.weekday - b.weekday);
}

export async function getReports(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reports", { p_date: date });
  fail(error);
  return data as {
    daily: { department: Department; status: AppointmentStatus; count: number }[];
    registrations: number;
    registrationsMonth: number;
    dentalCompleted: number;
    opticalCompleted: number;
    followUpsDue: number;
    averageWaitMinutes: number | null;
    cancellations: number;
    noShows: number;
  };
}

export async function getNotificationRows(limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []).map(mapNotification);
}

export async function getNotificationsForAppointment(appointmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(20);
  fail(error);
  return (data ?? []).map(mapNotification);
}

export async function getAuditForEntity(entityType: string, entityId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []) as AuditLog[];
}

export async function getAdminOverview(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview", { p_date: date });
  fail(error);
  return data as {
    staff: { role: string; count: number; active: number }[];
    staffTotal: number;
    staffActive: number;
    patients: number;
    newPatients: number;
    appointments: number;
    failedNotifications: number;
    pendingFollowUps: number;
  };
}

export async function getAppointmentTrend(days = 7) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_appointment_trend", { p_days: days });
  fail(error);
  return (data ?? []) as { date: string; count: number; completed: number; missed: number }[];
}

export async function getFollowUpsDue(department?: Department) {
  const supabase = await createClient();

  if (!department) {
    const { data, error } = await supabase.rpc("admin_follow_ups_due");
    fail(error);
    return (data ?? []) as {
      id: string;
      patient_id: string;
      dental_visit_id: string | null;
      tooth_numbers: string;
      diagnosis: string;
      procedure: string;
      priority: string;
      estimated_cost: number | null;
      status: string;
      notes: string | null;
      next_review_date: string | null;
      created_by: string;
      created_at: string;
      updated_at: string;
      full_name: string;
      patient_number: string;
      phone: string;
      department: Department;
    }[];
  }

  if (department === "dental") {
    const { data, error } = await supabase
      .from("treatment_plans")
      .select("*, patients!inner(full_name, patient_number, phone)")
      .not("next_review_date", "is", null)
      .lte("next_review_date", clinicToday())
      .in("status", ["Planned", "In Progress"])
      .order("next_review_date");
    fail(error);

    return ((data ?? []) as Row[]).map((row) => ({
      ...mapTreatmentPlan(row),
      full_name: row.patients?.full_name ?? "",
      patient_number: row.patients?.patient_number ?? "",
      phone: row.patients?.phone ?? "",
    }));
  }

  const { data, error } = await supabase
    .from("optical_visits")
    .select("*, patients!inner(full_name, patient_number, phone)")
    .not("follow_up_date", "is", null)
    .lte("follow_up_date", clinicToday())
    .order("follow_up_date");
  fail(error);

  return ((data ?? []) as Row[]).map((row) => {
    const visit = mapOpticalVisit(row);
    return {
      ...visit,
      id: visit.id,
      patient_id: visit.patient_id,
      dental_visit_id: null,
      tooth_numbers: "",
      diagnosis: visit.diagnosis ?? "",
      procedure: "Optical follow-up",
      priority: "Medium",
      estimated_cost: null,
      status: "Planned",
      next_review_date: visit.follow_up_date,
      created_by: visit.doctor_id,
      full_name: row.patients?.full_name ?? "",
      patient_number: row.patients?.patient_number ?? "",
      phone: row.patients?.phone ?? "",
    };
  });
}

/** Atomic patient-number allocation for the front desk. */
export async function nextPatientNumber() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_patient_number");
  fail(error);
  return data as string;
}
