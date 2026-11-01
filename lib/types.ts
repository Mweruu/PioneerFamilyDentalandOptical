export type Role = "dentist" | "receptionist" | "eye_doctor" | "admin";

export type Department = "dental" | "optical";

export type AppointmentStatus =
  | "Booked"
  | "Confirmed"
  | "Checked In"
  | "Waiting for Doctor"
  | "In Consultation"
  | "Completed"
  | "Cancelled"
  | "No Show";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  active: number;
  created_at: string;
};

export type Patient = {
  id: string;
  patient_number: string;
  full_name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string | null;
  medical_history: string | null;
  medications: string | null;
  conditions: string | null;
  admin_notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  reference: string;
  patient_id: string | null;
  patient_number: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  department: Department;
  doctor_id: string;
  doctor_name: string;
  service_id: string | null;
  service_name: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  reason: string;
  patient_type: "new" | "returning";
  notes: string | null;
  status: AppointmentStatus;
  source: "online" | "walk_in" | "staff";
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  department: Department;
  doctor_id: string | null;
  status: "Waiting" | "In Consultation" | "Completed" | "Cancelled";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Vitals = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature_c: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  observations: string | null;
  recorded_by: string;
  recorded_by_name: string | null;
  recorded_at: string;
};

export type DentalVisit = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  doctor_id: string;
  doctor_name: string | null;
  visit_date: string;
  presenting_complaint: string | null;
  history: string | null;
  examination_findings: string | null;
  diagnosis: string | null;
  treatment_performed: string | null;
  medications: string | null;
  advice: string | null;
  follow_up: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ToothFinding = {
  id: string;
  patient_id: string;
  dental_visit_id: string;
  tooth_number: string;
  dentition: "permanent" | "primary";
  condition: string;
  surfaces: string | null;
  diagnosis: string | null;
  planned_treatment: string | null;
  treatment_performed: string | null;
  treatment_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TreatmentPlan = {
  id: string;
  patient_id: string;
  dental_visit_id: string | null;
  tooth_numbers: string;
  diagnosis: string;
  procedure: string;
  priority: "Low" | "Medium" | "High";
  estimated_cost: number | null;
  status: "Planned" | "In Progress" | "Completed" | "Cancelled";
  notes: string | null;
  next_review_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OpticalVisit = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  doctor_id: string;
  doctor_name: string | null;
  visit_date: string;
  presenting_complaint: string | null;
  symptoms: string | null;
  unaided_va_od: string | null;
  unaided_va_os: string | null;
  pinhole_va_od: string | null;
  pinhole_va_os: string | null;
  corrected_va_od: string | null;
  corrected_va_os: string | null;
  external_examination: string | null;
  anterior_segment: string | null;
  posterior_segment: string | null;
  iop_od: string | null;
  iop_os: string | null;
  colour_vision: string | null;
  diagnosis: string | null;
  management_plan: string | null;
  referral: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpticalPrescription = {
  id: string;
  patient_id: string;
  optical_visit_id: string | null;
  doctor_id: string;
  doctor_name: string | null;
  od_sph: string | null;
  od_cyl: string | null;
  od_axis: string | null;
  od_add: string | null;
  od_prism: string | null;
  od_base: string | null;
  os_sph: string | null;
  os_cyl: string | null;
  os_axis: string | null;
  os_add: string | null;
  os_prism: string | null;
  os_base: string | null;
  pd: string | null;
  pd_od: string | null;
  pd_os: string | null;
  lens_type: string | null;
  lens_recommendation: string | null;
  frame_recommendation: string | null;
  notes: string | null;
  prescribed_at: string;
  created_at: string;
};

export type Service = {
  id: string;
  department: Department;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  active: number;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  patient_id: string | null;
  details: string | null;
  ip: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  appointment_id: string | null;
  channel: "sms" | "email";
  recipient: string;
  template: string;
  status: "queued" | "sent" | "failed" | "not_configured";
  payload: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

export const ROLE_LABELS: Record<Role, string> = {
  dentist: "Dentist",
  receptionist: "Receptionist",
  eye_doctor: "Eye Doctor",
  admin: "Administrator",
};

export const ROLE_HOME: Record<Role, string> = {
  dentist: "/staff/dentist",
  receptionist: "/staff/receptionist",
  eye_doctor: "/staff/optometrist",
  admin: "/staff/admin",
};

export const DEPARTMENTS: Record<Department, string> = {
  dental: "Dental",
  optical: "Optical",
};

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "Booked",
  "Confirmed",
  "Checked In",
  "Waiting for Doctor",
  "In Consultation",
  "Completed",
  "Cancelled",
  "No Show",
];

export const TOOTH_CONDITIONS = [
  "Healthy",
  "Dental caries",
  "Fracture",
  "Missing tooth",
  "Existing filling / restoration",
  "Crown",
  "Root canal treated",
  "Extraction required",
  "Extracted",
  "Other",
] as const;

export const TOOTH_SURFACES = ["Mesial", "Distal", "Buccal / facial", "Lingual / palatal", "Occlusal / incisal"] as const;

export const TOOTH_STATUSES = ["Planned", "In Progress", "Completed", "Monitoring"] as const;

export const PERMANENT_TEETH = {
  upperRight: ["18", "17", "16", "15", "14", "13", "12", "11"],
  upperLeft: ["21", "22", "23", "24", "25", "26", "27", "28"],
  lowerLeft: ["31", "32", "33", "34", "35", "36", "37", "38"],
  lowerRight: ["48", "47", "46", "45", "44", "43", "42", "41"],
};

export const PRIMARY_TEETH = {
  upperRight: ["55", "54", "53", "52", "51"],
  upperLeft: ["61", "62", "63", "64", "65"],
  lowerLeft: ["71", "72", "73", "74", "75"],
  lowerRight: ["85", "84", "83", "82", "81"],
};
