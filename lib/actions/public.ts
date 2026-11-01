"use server";

import { z } from "zod";
import { db } from "../db";
import { logAudit } from "../audit";
import { queueAppointmentNotification } from "../notifications";
import { getAppointmentByReference, getAvailableSlots, getDoctorSchedule, hasAppointmentOverlap } from "../data/queries";
import type { Appointment, Department } from "../types";
import { clinicToday, formatDate, formatTime, nowIso, reference } from "../utils";

export type BookingResult = {
  reference: string;
  date: string;
  time: string;
  department: Department;
  doctorName: string;
  phone: string;
  email: string | null;
};

export type BookingState =
  | {
      error?: string;
      booking?: BookingResult;
    }
  | null;

const bookingSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's full name.").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  email: z.union([z.string().trim().email("Enter a valid email address."), z.literal("")]).optional(),
  dateOfBirth: z.union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth."), z.literal("")]).optional(),
  gender: z.string().trim().max(30).optional(),
  department: z.enum(["dental", "optical"]),
  doctorId: z.string().min(1, "Select a doctor."),
  serviceId: z.string().min(1, "Select a service."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Select a time."),
  reason: z.string().trim().min(5, "Tell us briefly why you need to be seen.").max(1000),
  patientType: z.enum(["new", "returning"]),
  notes: z.string().trim().max(1000).optional(),
});

export async function bookAppointmentAction(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const parsed = bookingSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    dateOfBirth: formData.get("dateOfBirth") || "",
    gender: formData.get("gender") || "",
    department: formData.get("department"),
    doctorId: formData.get("doctorId"),
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
    time: formData.get("time"),
    reason: formData.get("reason"),
    patientType: formData.get("patientType"),
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the booking form." };
  }

  const data = parsed.data;
  if (data.date < clinicToday()) return { error: "Choose today or a future date." };

  const doctor = db
    .prepare("SELECT id, name, role, active FROM staff WHERE id = ?")
    .get(data.doctorId) as { id: string; name: string; role: string; active: number } | undefined;
  const expectedRole = data.department === "dental" ? "dentist" : "eye_doctor";
  if (!doctor || !doctor.active || doctor.role !== expectedRole) {
    return { error: "The selected doctor is not available for this appointment type." };
  }

  const service = db
    .prepare("SELECT id, name, duration_minutes, department, active FROM services WHERE id = ?")
    .get(data.serviceId) as
    | { id: string; name: string; duration_minutes: number; department: string; active: number }
    | undefined;
  if (!service || !service.active || service.department !== data.department) {
    return { error: "The selected service is not available." };
  }

  const schedule = getDoctorSchedule(doctor.id, data.date);
  if (!schedule) return { error: "The doctor does not have a clinic session on that day. Choose another date." };

  const duration = service.duration_minutes;
  const slots = getAvailableSlots(doctor.id, data.date, duration);
  const slot = slots.find((s) => s.time === data.time);
  if (!slot || !slot.available) {
    return { error: "That time has just been taken. Please choose another available time." };
  }

  if (hasAppointmentOverlap(doctor.id, data.date, data.time, duration)) {
    return { error: "That appointment slot overlaps with an existing booking. Please choose another time." };
  }

  const id = crypto.randomUUID();
  const ref = reference();
  const now = nowIso();

  try {
    db.prepare(`
      INSERT INTO appointments (id, reference, patient_id, full_name, phone, email, date_of_birth, gender,
        department, doctor_id, service_id, appointment_date, appointment_time, duration_minutes, reason,
        patient_type, notes, status, source, checked_in_at, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Booked', 'online', NULL, ?, ?)
    `).run(
      id,
      ref,
      data.fullName,
      data.phone,
      data.email || null,
      data.dateOfBirth || null,
      data.gender || null,
      data.department,
      data.doctorId,
      data.serviceId,
      data.date,
      data.time,
      duration,
      data.reason,
      data.patientType,
      data.notes || null,
      now,
      now,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return { error: "That appointment slot was just booked by someone else. Please choose another time." };
    }
    return { error: "We could not save the appointment. Please try again or call the clinic." };
  }

  await queueAppointmentNotification(id, "booking_confirmation");
  await logAudit({
    action: "appointment.public_booking",
    entityType: "appointment",
    entityId: id,
    details: `Online booking ${ref} created for ${data.department} on ${data.date} at ${data.time}.`,
  });

  return {
    booking: {
      reference: ref,
      date: data.date,
      time: data.time,
      department: data.department,
      doctorName: doctor.name,
      phone: data.phone,
      email: data.email || null,
    },
  };
}

const lookupSchema = z.object({
  reference: z.string().trim().min(5, "Enter your appointment reference."),
  fullName: z.string().trim().min(2, "Enter the full name used for the booking."),
  phone: z.string().trim().min(7, "Enter the phone number used for the booking."),
});

export type LookupState =
  | {
      error?: string;
      appointment?: {
        reference: string;
        fullName: string;
        phone: string;
        department: Department;
        doctorName: string;
        date: string;
        time: string;
        status: string;
        cancellable: boolean;
      };
      cancelled?: boolean;
      message?: string;
    }
  | null;

function phoneDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^254/, "0");
}

function verifyAppointment(data: { reference: string; fullName: string; phone: string }) {
  const appointment = getAppointmentByReference(data.reference.trim().toUpperCase());
  if (!appointment) return null;
  const samePhone = phoneDigits(appointment.phone) === phoneDigits(data.phone);
  const sameName = appointment.full_name.trim().toLowerCase() === data.fullName.trim().toLowerCase();
  if (!samePhone || !sameName) return null;
  return appointment;
}

export async function lookupAppointmentAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = lookupSchema.safeParse({
    reference: formData.get("reference"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the lookup details." };

  const appointment = verifyAppointment(parsed.data);
  if (!appointment) {
    await logAudit({
      action: "appointment.lookup_failed",
      details: `Failed public lookup for reference ${parsed.data.reference}.`,
    });
    return { error: "We could not verify an appointment with those details. Check the reference, name and phone number." };
  }

  await logAudit({
    action: "appointment.public_lookup",
    entityType: "appointment",
    entityId: appointment.id,
    patientId: appointment.patient_id,
    details: `Verified public lookup for ${appointment.reference}.`,
  });

  return {
    appointment: {
      reference: appointment.reference,
      fullName: appointment.full_name,
      phone: appointment.phone,
      department: appointment.department,
      doctorName: appointment.doctor_name,
      date: appointment.appointment_date,
      time: appointment.appointment_time,
      status: appointment.status,
      cancellable: ["Booked", "Confirmed"].includes(appointment.status),
    },
  };
}

export async function cancelPublicAppointmentAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = lookupSchema.safeParse({
    reference: formData.get("reference"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the cancellation details." };

  const appointment = verifyAppointment(parsed.data);
  if (!appointment) {
    return { error: "We could not verify that appointment. No changes were made." };
  }
  if (!["Booked", "Confirmed"].includes(appointment.status)) {
    return { error: "This appointment can no longer be cancelled online. Please call the clinic." };
  }

  db.prepare("UPDATE appointments SET status = 'Cancelled', updated_at = ? WHERE id = ?").run(
    nowIso(),
    appointment.id,
  );
  await queueAppointmentNotification(appointment.id, "cancellation");
  await logAudit({
    action: "appointment.public_cancellation",
    entityType: "appointment",
    entityId: appointment.id,
    patientId: appointment.patient_id,
    details: `Patient cancelled ${appointment.reference} online.`,
  });

  return {
    cancelled: true,
    message: `Appointment ${appointment.reference} on ${formatDate(appointment.appointment_date)} at ${formatTime(appointment.appointment_time)} has been cancelled.`,
  };
}

export async function availabilityAction(doctorId: string, date: string, duration = 30) {
  if (!doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return getAvailableSlots(doctorId, date, duration);
}

export type PublicAppointment = Appointment;
