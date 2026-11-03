"use server";

import { z } from "zod";
import { createClient } from "../supabase/server";
import { logAudit } from "../audit";
import { queueAppointmentNotification, type NotificationAppointment } from "../notifications";
import type { Appointment, Department } from "../types";
import { clinicToday, formatDate, formatTime } from "../utils";

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

type PublicBookingResponse = {
  ok: boolean;
  error?: string;
  id?: string;
  reference?: string;
  date?: string;
  time?: string;
  department?: Department;
  doctor_name?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  patient_id?: string | null;
};

const bookingSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's full name.").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  email: z.union([z.string().trim().email("Enter a valid email address."), z.literal("")]).optional(),
  dateOfBirth: z
    .union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth."), z.literal("")])
    .optional(),
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

function notificationAppointment(data: PublicBookingResponse): NotificationAppointment {
  return {
    id: data.id!,
    reference: data.reference!,
    full_name: data.full_name!,
    phone: data.phone!,
    email: data.email ?? null,
    department: data.department!,
    appointment_date: data.date!,
    appointment_time: data.time!,
    doctor_name: data.doctor_name ?? "the clinic",
  };
}

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

  const supabase = await createClient();
  const { data: result, error } = await supabase.rpc("public_book_appointment", {
    p_full_name: data.fullName,
    p_phone: data.phone,
    p_email: data.email || null,
    p_date_of_birth: data.dateOfBirth || null,
    p_gender: data.gender || null,
    p_department: data.department,
    p_doctor_id: data.doctorId,
    p_service_id: data.serviceId,
    p_date: data.date,
    p_time: data.time,
    p_reason: data.reason,
    p_patient_type: data.patientType,
    p_notes: data.notes || null,
  });

  if (error) {
    return { error: "We could not save the appointment. Please try again or call the clinic." };
  }

  const booking = result as PublicBookingResponse;
  if (!booking?.ok || !booking.id || !booking.reference) {
    return { error: booking?.error ?? "We could not save the appointment. Please try again or call the clinic." };
  }

  await queueAppointmentNotification(booking.id, "booking_confirmation", {
    publicEvent: true,
    appointment: notificationAppointment(booking),
  });
  await logAudit({
    publicEvent: true,
    action: "appointment.public_booking",
    entityType: "appointment",
    entityId: booking.id,
    details: `Online booking ${booking.reference} created for ${data.department} on ${data.date} at ${data.time}.`,
  });

  return {
    booking: {
      reference: booking.reference,
      date: data.date,
      time: data.time,
      department: data.department,
      doctorName: booking.doctor_name ?? "the clinic",
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

type LookupAppointment = {
  id: string;
  patient_id: string | null;
  reference: string;
  full_name: string;
  phone: string;
  email: string | null;
  department: Department;
  doctor_name: string;
  date: string;
  time: string;
  status: string;
  cancellable: boolean;
};

type PublicLookupResponse = {
  ok: boolean;
  error?: string;
  appointment?: LookupAppointment;
};

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

export async function lookupAppointmentAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = lookupSchema.safeParse({
    reference: formData.get("reference"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the lookup details." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_lookup_appointment", {
    p_reference: parsed.data.reference.trim().toUpperCase(),
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  });

  if (error) {
    return { error: "We could not verify an appointment with those details. Check the reference, name and phone number." };
  }

  const result = data as PublicLookupResponse;
  if (!result?.ok || !result.appointment) {
    await logAudit({
      publicEvent: true,
      action: "appointment.lookup_failed",
      details: `Failed public lookup for reference ${parsed.data.reference}.`,
    });
    return { error: result?.error ?? "We could not verify an appointment with those details. Check the reference, name and phone number." };
  }

  const appointment = result.appointment;
  await logAudit({
    publicEvent: true,
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
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      cancellable: appointment.cancellable,
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_cancel_appointment", {
    p_reference: parsed.data.reference.trim().toUpperCase(),
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  });

  if (error) {
    return { error: "We could not verify that appointment. No changes were made." };
  }

  const result = data as PublicLookupResponse;
  if (!result?.ok || !result.appointment) {
    return { error: result?.error ?? "We could not verify that appointment. No changes were made." };
  }

  const appointment = result.appointment;
  await queueAppointmentNotification(appointment.id, "cancellation", {
    publicEvent: true,
    appointment: {
      id: appointment.id,
      reference: appointment.reference,
      full_name: appointment.full_name,
      phone: appointment.phone,
      email: appointment.email,
      department: appointment.department,
      appointment_date: appointment.date,
      appointment_time: appointment.time,
      doctor_name: appointment.doctor_name,
    },
  });
  await logAudit({
    publicEvent: true,
    action: "appointment.public_cancellation",
    entityType: "appointment",
    entityId: appointment.id,
    patientId: appointment.patient_id,
    details: `Patient cancelled ${appointment.reference} online.`,
  });

  return {
    cancelled: true,
    message: `Appointment ${appointment.reference} on ${formatDate(appointment.date)} at ${formatTime(appointment.time)} has been cancelled.`,
  };
}

export async function availabilityAction(doctorId: string, date: string, duration = 30) {
  if (!doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_available_slots", {
    p_doctor_id: doctorId,
    p_date: date,
    p_duration: duration,
  });

  if (error) return [];
  return (data ?? []) as { time: string; available: boolean }[];
}

export type PublicAppointment = Appointment;
