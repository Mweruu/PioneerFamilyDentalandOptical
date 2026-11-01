import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { clinicToday, nowIso } from "./utils";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.CLINIC_DB_PATH || path.join(dataDir, "clinic.db");

declare global {
  // eslint-disable-next-line no-var
  var __pioneerClinicDb: Database.Database | undefined;
}

function createDb() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  seed(db);
  return db;
}

export const db = globalThis.__pioneerClinicDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__pioneerClinicDb = db;

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('dentist','receptionist','eye_doctor','admin')),
      title TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      patient_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      date_of_birth TEXT,
      gender TEXT,
      address TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      allergies TEXT,
      medical_history TEXT,
      medications TEXT,
      conditions TEXT,
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
    CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patient_number);

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      department TEXT NOT NULL CHECK (department IN ('dental','optical')),
      name TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      price REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_start TEXT,
      break_end TEXT,
      slot_minutes INTEGER NOT NULL DEFAULT 30,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(doctor_id, weekday)
    );

    CREATE TABLE IF NOT EXISTS blocked_periods (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      date_of_birth TEXT,
      gender TEXT,
      department TEXT NOT NULL CHECK (department IN ('dental','optical')),
      doctor_id TEXT NOT NULL REFERENCES staff(id),
      service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      reason TEXT NOT NULL,
      patient_type TEXT NOT NULL DEFAULT 'new' CHECK (patient_type IN ('new','returning')),
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked','Confirmed','Checked In','Waiting for Doctor','In Consultation','Completed','Cancelled','No Show')),
      source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online','walk_in','staff')),
      checked_in_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id, appointment_date);
    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_exact_slot
      ON appointments(doctor_id, appointment_date, appointment_time)
      WHERE status NOT IN ('Cancelled','No Show');

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      department TEXT NOT NULL CHECK (department IN ('dental','optical')),
      doctor_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting','In Consultation','Completed','Cancelled')),
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id, created_at);

    CREATE TABLE IF NOT EXISTS vitals (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      pulse INTEGER,
      temperature_c REAL,
      respiratory_rate INTEGER,
      spo2 INTEGER,
      weight_kg REAL,
      height_cm REAL,
      bmi REAL,
      observations TEXT,
      recorded_by TEXT NOT NULL REFERENCES staff(id),
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id, recorded_at);

    CREATE TABLE IF NOT EXISTS dental_visits (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
      doctor_id TEXT NOT NULL REFERENCES staff(id),
      visit_date TEXT NOT NULL,
      presenting_complaint TEXT,
      history TEXT,
      examination_findings TEXT,
      diagnosis TEXT,
      treatment_performed TEXT,
      medications TEXT,
      advice TEXT,
      follow_up TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dental_visits_patient ON dental_visits(patient_id, visit_date);

    CREATE TABLE IF NOT EXISTS tooth_findings (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      dental_visit_id TEXT NOT NULL REFERENCES dental_visits(id) ON DELETE CASCADE,
      tooth_number TEXT NOT NULL,
      dentition TEXT NOT NULL DEFAULT 'permanent' CHECK (dentition IN ('permanent','primary')),
      condition TEXT NOT NULL,
      surfaces TEXT,
      diagnosis TEXT,
      planned_treatment TEXT,
      treatment_performed TEXT,
      treatment_date TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(dental_visit_id, tooth_number)
    );
    CREATE INDEX IF NOT EXISTS idx_tooth_findings_patient ON tooth_findings(patient_id, tooth_number);

    CREATE TABLE IF NOT EXISTS treatment_plans (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      dental_visit_id TEXT REFERENCES dental_visits(id) ON DELETE SET NULL,
      tooth_numbers TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      procedure TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
      estimated_cost REAL,
      status TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned','In Progress','Completed','Cancelled')),
      notes TEXT,
      next_review_date TEXT,
      created_by TEXT NOT NULL REFERENCES staff(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id, created_at);

    CREATE TABLE IF NOT EXISTS optical_visits (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
      doctor_id TEXT NOT NULL REFERENCES staff(id),
      visit_date TEXT NOT NULL,
      presenting_complaint TEXT,
      symptoms TEXT,
      unaided_va_od TEXT,
      unaided_va_os TEXT,
      pinhole_va_od TEXT,
      pinhole_va_os TEXT,
      corrected_va_od TEXT,
      corrected_va_os TEXT,
      external_examination TEXT,
      anterior_segment TEXT,
      posterior_segment TEXT,
      iop_od TEXT,
      iop_os TEXT,
      colour_vision TEXT,
      diagnosis TEXT,
      management_plan TEXT,
      referral TEXT,
      follow_up_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_optical_visits_patient ON optical_visits(patient_id, visit_date);

    CREATE TABLE IF NOT EXISTS optical_prescriptions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      optical_visit_id TEXT REFERENCES optical_visits(id) ON DELETE SET NULL,
      doctor_id TEXT NOT NULL REFERENCES staff(id),
      od_sph TEXT,
      od_cyl TEXT,
      od_axis TEXT,
      od_add TEXT,
      od_prism TEXT,
      od_base TEXT,
      os_sph TEXT,
      os_cyl TEXT,
      os_axis TEXT,
      os_add TEXT,
      os_prism TEXT,
      os_base TEXT,
      pd TEXT,
      pd_od TEXT,
      pd_os TEXT,
      lens_type TEXT,
      lens_recommendation TEXT,
      frame_recommendation TEXT,
      notes TEXT,
      prescribed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_optical_rx_patient ON optical_prescriptions(patient_id, prescribed_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
      recipient TEXT NOT NULL,
      template TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','not_configured')),
      payload TEXT,
      error TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notifications(appointment_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      patient_id TEXT,
      details TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_patient ON audit_logs(patient_id);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clinic_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seed(database: Database.Database) {
  const now = nowIso();
  const today = clinicToday();
  const daysAgo = (n: number) => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const insertStaff = database.prepare(`
    INSERT INTO staff (id, name, email, password_hash, role, title, active, created_at, updated_at)
    VALUES (@id, @name, @email, @password_hash, @role, @title, 1, @created_at, @updated_at)
  `);

  const staff = [
    {
      id: "usr_admin",
      name: "Clinic Administrator",
      email: "admin@pioneerclinic.co.ke",
      password: "Admin@12345",
      role: "admin",
      title: "Clinic Administrator",
    },
    {
      id: "usr_reception",
      name: "Grace Achieng",
      email: "reception@pioneerclinic.co.ke",
      password: "Reception@123",
      role: "receptionist",
      title: "Front Desk & Triage",
    },
    {
      id: "usr_dentist",
      name: "Dr. Wanjiku Kamau",
      email: "dentist@pioneerclinic.co.ke",
      password: "Dentist@123",
      role: "dentist",
      title: "Dental Surgeon",
    },
    {
      id: "usr_dentist_2",
      name: "Dr. Samuel Kariuki",
      email: "dentist2@pioneerclinic.co.ke",
      password: "Dentist@123",
      role: "dentist",
      title: "Dental Surgeon",
    },
    {
      id: "usr_optometrist",
      name: "Dr. Brian Otieno",
      email: "optometrist@pioneerclinic.co.ke",
      password: "Optical@123",
      role: "eye_doctor",
      title: "Optometrist",
    },
  ];

  const seedTx = database.transaction(() => {
    // Check inside the write transaction so parallel build workers or server
    // instances cannot both decide the database is empty and seed twice.
    const staffCount = database.prepare("SELECT COUNT(*) as count FROM staff").get() as { count: number };
    if (staffCount.count > 0) return;

    for (const s of staff) {
      insertStaff.run({
        id: s.id,
        name: s.name,
        email: s.email,
        password_hash: bcrypt.hashSync(s.password, 10),
        role: s.role,
        title: s.title,
        created_at: now,
        updated_at: now,
      });
    }

    const insertService = database.prepare(`
      INSERT INTO services (id, department, name, description, duration_minutes, price, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const services = [
      ["svc_d_consult", "dental", "Dental consultation", "Assessment, diagnosis and a personalised treatment plan.", 30, 1500],
      ["svc_d_exam", "dental", "Dental examination", "Comprehensive oral examination and preventive advice.", 30, 1000],
      ["svc_d_filling", "dental", "Tooth filling", "Restoration of a decayed or damaged tooth.", 45, 3500],
      ["svc_d_extract", "dental", "Tooth extraction", "Safe removal of a tooth when preservation is not possible.", 45, 3000],
      ["svc_d_scale", "dental", "Scaling & polishing", "Professional cleaning to remove plaque and tartar.", 40, 2500],
      ["svc_d_rct", "dental", "Root canal treatment", "Treatment to save an infected or badly damaged tooth.", 60, 12000],
      ["svc_o_exam", "optical", "Eye examination", "Comprehensive vision and eye health assessment.", 30, 1500],
      ["svc_o_vision", "optical", "Vision testing", "Visual acuity and functional vision testing.", 20, 800],
      ["svc_o_refraction", "optical", "Refraction", "Measurement of refractive error for spectacles.", 30, 1200],
      ["svc_o_rx", "optical", "Spectacle prescription", "Prescription issued after a refraction assessment.", 20, 1000],
      ["svc_o_health", "optical", "Eye health assessment", "Anterior and posterior segment examination.", 40, 2500],
      ["svc_o_follow", "optical", "Optical follow-up", "Review of treatment, prescription or eye health.", 20, 800],
    ] as const;
    for (const [id, department, name, description, duration, price] of services) {
      insertService.run(id, department, name, description, duration, price, now);
    }

    const schedule = database.prepare(`
      INSERT INTO doctor_schedules (id, doctor_id, weekday, start_time, end_time, break_start, break_end, slot_minutes, active)
      VALUES (?, ?, ?, '08:00', '17:00', '13:00', '14:00', 30, 1)
    `);
    for (const doctor of ["usr_dentist", "usr_dentist_2", "usr_optometrist"]) {
      for (let weekday = 1; weekday <= 6; weekday++) {
        schedule.run(`sch_${doctor}_${weekday}`, doctor, weekday);
      }
    }

    const settings = [
      ["clinic_name", "Pioneer Family Dental and Optical Clinic"],
      ["clinic_phone", "+254 712 345 678"],
      ["clinic_email", "hello@pioneerclinic.co.ke"],
      ["clinic_address", "Pioneer Plaza, 2nd Floor, Ngong Road, Nairobi, Kenya"],
      ["clinic_hours", "Mon–Fri: 8:00 AM – 5:00 PM · Sat: 8:00 AM – 2:00 PM"],
      ["appointment_duration", "30"],
      ["notification_sms_enabled", "false"],
      ["notification_email_enabled", "false"],
      ["notification_sender", "Pioneer Family Clinic"],
      ["privacy_contact", "privacy@pioneerclinic.co.ke"],
    ];
    const insertSetting = database.prepare(
      "INSERT INTO clinic_settings (key, value, updated_at) VALUES (?, ?, ?)",
    );
    for (const [key, value] of settings) insertSetting.run(key, value, now);

    const insertPatient = database.prepare(`
      INSERT INTO patients (id, patient_number, full_name, phone, email, date_of_birth, gender, address,
        emergency_contact_name, emergency_contact_phone, allergies, medical_history, medications, conditions,
        admin_notes, created_at, updated_at)
      VALUES (@id, @patient_number, @full_name, @phone, @email, @date_of_birth, @gender, @address,
        @emergency_contact_name, @emergency_contact_phone, @allergies, @medical_history, @medications, @conditions,
        @admin_notes, @created_at, @updated_at)
    `);
    const patients = [
      {
        id: "pat_mary",
        patient_number: "PFC-2026-0001",
        full_name: "Mary Wambui",
        phone: "0712345678",
        email: "mary.wambui@example.com",
        date_of_birth: "1988-04-12",
        gender: "Female",
        address: "Kilimani, Nairobi",
        emergency_contact_name: "John Wambui",
        emergency_contact_phone: "0722000111",
        allergies: "Penicillin",
        medical_history: "Hypertension, managed with medication.",
        medications: "Amlodipine 5mg once daily",
        conditions: "Hypertension",
        admin_notes: "Prefers morning appointments.",
      },
      {
        id: "pat_peter",
        patient_number: "PFC-2026-0002",
        full_name: "Peter Mwangi",
        phone: "0723456789",
        email: null,
        date_of_birth: "1979-11-03",
        gender: "Male",
        address: "Kawangware, Nairobi",
        emergency_contact_name: "Esther Mwangi",
        emergency_contact_phone: "0733000222",
        allergies: "None known",
        medical_history: "Type 2 diabetes.",
        medications: "Metformin 500mg twice daily",
        conditions: "Type 2 diabetes",
        admin_notes: null,
      },
      {
        id: "pat_aisha",
        patient_number: "PFC-2026-0003",
        full_name: "Aisha Noor",
        phone: "0734567890",
        email: "aisha.noor@example.com",
        date_of_birth: "1995-07-21",
        gender: "Female",
        address: "Parklands, Nairobi",
        emergency_contact_name: "Hassan Noor",
        emergency_contact_phone: "0744000333",
        allergies: "None known",
        medical_history: "No significant medical history.",
        medications: "None",
        conditions: null,
        admin_notes: null,
      },
      {
        id: "pat_daniel",
        patient_number: "PFC-2026-0004",
        full_name: "Daniel Kipchoge",
        phone: "0745678901",
        email: null,
        date_of_birth: "2001-02-18",
        gender: "Male",
        address: "Lavington, Nairobi",
        emergency_contact_name: "Ruth Kipchoge",
        emergency_contact_phone: "0755000444",
        allergies: "Sulfa drugs",
        medical_history: "Asthma.",
        medications: "Salbutamol inhaler as needed",
        conditions: "Asthma",
        admin_notes: "Student — prefers afternoon appointments.",
      },
    ];
    for (const p of patients) {
      insertPatient.run({ ...p, created_at: now, updated_at: now });
    }

    const insertAppointment = database.prepare(`
      INSERT INTO appointments (id, reference, patient_id, full_name, phone, email, date_of_birth, gender,
        department, doctor_id, service_id, appointment_date, appointment_time, duration_minutes, reason,
        patient_type, notes, status, source, checked_in_at, created_at, updated_at)
      VALUES (@id, @reference, @patient_id, @full_name, @phone, @email, @date_of_birth, @gender,
        @department, @doctor_id, @service_id, @appointment_date, @appointment_time, @duration_minutes, @reason,
        @patient_type, @notes, @status, @source, @checked_in_at, @created_at, @updated_at)
    `);

    const appts = [
      {
        id: "apt_today_mary",
        reference: "PF-DEMO-1001",
        patient_id: "pat_mary",
        full_name: "Mary Wambui",
        phone: "0712345678",
        email: "mary.wambui@example.com",
        date_of_birth: "1988-04-12",
        gender: "Female",
        department: "dental",
        doctor_id: "usr_dentist",
        service_id: "svc_d_consult",
        appointment_date: today,
        appointment_time: "09:00",
        duration_minutes: 30,
        reason: "Sensitivity on lower right molar",
        patient_type: "returning",
        notes: null,
        status: "Waiting for Doctor",
        source: "online",
        checked_in_at: now,
      },
      {
        id: "apt_today_peter",
        reference: "PF-DEMO-1002",
        patient_id: "pat_peter",
        full_name: "Peter Mwangi",
        phone: "0723456789",
        email: null,
        date_of_birth: "1979-11-03",
        gender: "Male",
        department: "dental",
        doctor_id: "usr_dentist",
        service_id: "svc_d_scale",
        appointment_date: today,
        appointment_time: "10:00",
        duration_minutes: 40,
        reason: "Routine scaling and polishing",
        patient_type: "returning",
        notes: null,
        status: "Booked",
        source: "online",
        checked_in_at: null,
      },
      {
        id: "apt_today_aisha",
        reference: "PF-DEMO-1003",
        patient_id: "pat_aisha",
        full_name: "Aisha Noor",
        phone: "0734567890",
        email: "aisha.noor@example.com",
        date_of_birth: "1995-07-21",
        gender: "Female",
        department: "optical",
        doctor_id: "usr_optometrist",
        service_id: "svc_o_exam",
        appointment_date: today,
        appointment_time: "09:30",
        duration_minutes: 30,
        reason: "Blurred distance vision and headaches",
        patient_type: "returning",
        notes: null,
        status: "Waiting for Doctor",
        source: "online",
        checked_in_at: now,
      },
      {
        id: "apt_today_daniel",
        reference: "PF-DEMO-1004",
        patient_id: "pat_daniel",
        full_name: "Daniel Kipchoge",
        phone: "0745678901",
        email: null,
        date_of_birth: "2001-02-18",
        gender: "Male",
        department: "optical",
        doctor_id: "usr_optometrist",
        service_id: "svc_o_refraction",
        appointment_date: today,
        appointment_time: "11:00",
        duration_minutes: 30,
        reason: "New spectacle prescription",
        patient_type: "new",
        notes: "First visit to Pioneer.",
        status: "Confirmed",
        source: "online",
        checked_in_at: null,
      },
    ];
    for (const a of appts) {
      insertAppointment.run({ ...a, created_at: now, updated_at: now });
    }

    database.prepare(`
      INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'Waiting', ?, ?)
    `).run("vis_today_mary", "pat_mary", "apt_today_mary", "dental", "usr_dentist", now, now);
    database.prepare(`
      INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'Waiting', ?, ?)
    `).run("vis_today_aisha", "pat_aisha", "apt_today_aisha", "optical", "usr_optometrist", now, now);

    const insertVitals = database.prepare(`
      INSERT INTO vitals (id, patient_id, visit_id, bp_systolic, bp_diastolic, pulse, temperature_c,
        respiratory_rate, spo2, weight_kg, height_cm, bmi, observations, recorded_by, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertVitals.run("vit_mary_today", "pat_mary", "vis_today_mary", 128, 82, 76, 36.6, 16, 98, 68, 164, 25.3, "Patient reports mild dental sensitivity. No acute distress.", "usr_reception", now);
    insertVitals.run("vit_aisha_today", "pat_aisha", "vis_today_aisha", 118, 76, 72, 36.5, 15, 99, 58, 162, 22.1, "No acute concerns.", "usr_reception", now);

    const insertDentalVisit = database.prepare(`
      INSERT INTO dental_visits (id, patient_id, visit_id, doctor_id, visit_date, presenting_complaint, history,
        examination_findings, diagnosis, treatment_performed, medications, advice, follow_up, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDentalVisit.run(
      "dv_mary_prev",
      "pat_mary",
      null,
      "usr_dentist",
      daysAgo(21),
      "Occasional sensitivity to cold drinks on the lower right side.",
      "Symptoms started about one month ago and are intermittent.",
      "Caries noted on the occlusal surface of tooth 46. Gingiva healthy. No swelling.",
      "Dental caries — tooth 46",
      "Composite filling placed on tooth 46.",
      "Ibuprofen 400mg as needed for discomfort.",
      "Avoid very cold foods for 48 hours. Maintain twice-daily brushing and flossing.",
      "Review in six months or sooner if symptoms persist.",
      "Patient tolerated the procedure well.",
      now,
      now,
    );

    const insertTooth = database.prepare(`
      INSERT INTO tooth_findings (id, patient_id, dental_visit_id, tooth_number, dentition, condition, surfaces,
        diagnosis, planned_treatment, treatment_performed, treatment_date, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'permanent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTooth.run("tf_mary_46", "pat_mary", "dv_mary_prev", "46", "Existing filling / restoration", '["Occlusal / incisal"]', "Dental caries — tooth 46", "Composite restoration", "Composite filling placed", daysAgo(21), "Restoration intact at review.", "Completed", now, now);
    insertTooth.run("tf_mary_36", "pat_mary", "dv_mary_prev", "36", "Dental caries", '["Occlusal / incisal"]', "Early occlusal caries — tooth 36", "Preventive sealant or restoration if progression", null, null, "Monitor at next visit.", "Monitoring", now, now);

    database.prepare(`
      INSERT INTO treatment_plans (id, patient_id, dental_visit_id, tooth_numbers, diagnosis, procedure, priority,
        estimated_cost, status, notes, next_review_date, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "tp_mary_36",
      "pat_mary",
      "dv_mary_prev",
      "36",
      "Early occlusal caries",
      "Preventive sealant and review",
      "Medium",
      2500,
      "Planned",
      "Review at next dental visit before restorative treatment.",
      daysAgo(-160),
      "usr_dentist",
      now,
      now,
    );

    const insertOpticalVisit = database.prepare(`
      INSERT INTO optical_visits (id, patient_id, visit_id, doctor_id, visit_date, presenting_complaint, symptoms,
        unaided_va_od, unaided_va_os, pinhole_va_od, pinhole_va_os, corrected_va_od, corrected_va_os,
        external_examination, anterior_segment, posterior_segment, iop_od, iop_os, colour_vision, diagnosis,
        management_plan, referral, follow_up_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertOpticalVisit.run(
      "ov_aisha_prev",
      "pat_aisha",
      null,
      "usr_optometrist",
      daysAgo(18),
      "Blurred distance vision and occasional headaches.",
      '["Blurred vision","Headaches","Difficulty seeing distant objects"]',
      "6/18",
      "6/12",
      "6/9",
      "6/9",
      "6/6",
      "6/6",
      "Lids and lashes normal. No discharge.",
      "Clear cornea and quiet anterior chamber.",
      "Optic discs healthy, macula normal.",
      "16",
      "15",
      "Normal colour vision",
      "Mild myopia with astigmatism",
      "Prescribed spectacles for distance use. Advised on screen breaks and hydration.",
      null,
      daysAgo(-180),
      "Patient reports improved comfort with prescribed correction.",
      now,
      now,
    );
    database.prepare(`
      INSERT INTO optical_prescriptions (id, patient_id, optical_visit_id, doctor_id, od_sph, od_cyl, od_axis,
        od_add, od_prism, od_base, os_sph, os_cyl, os_axis, os_add, os_prism, os_base, pd, pd_od, pd_os,
        lens_type, lens_recommendation, frame_recommendation, notes, prescribed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "rx_aisha_prev",
      "pat_aisha",
      "ov_aisha_prev",
      "usr_optometrist",
      "-1.25",
      "-0.50",
      "180",
      null,
      null,
      null,
      "-1.00",
      "-0.25",
      "175",
      null,
      null,
      null,
      "62",
      "31",
      "31",
      "Single vision",
      "Anti-reflective, blue-light filtering lenses",
      "Lightweight acetate frame recommended",
      "Distance spectacles. Review if headaches persist.",
      now,
      now,
    );

    database.prepare(`
      INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, patient_id, details, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("audit_seed", "usr_admin", "Clinic Administrator", "admin", "system.seed", "system", null, null, "Demo clinic data initialised.", null, now);
  });

  // BEGIN IMMEDIATE takes the write lock up front, so concurrent processes
  // serialise here and the second one sees the completed seed.
  seedTx.immediate();
}
