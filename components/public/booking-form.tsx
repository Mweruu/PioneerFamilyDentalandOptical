"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Phone,
  ShieldCheck,
  Smile,
} from "lucide-react";
import { bookAppointmentAction, availabilityAction, type BookingState } from "@/lib/actions/public";
import type { Department, Service, StaffUser } from "@/lib/types";
import { cn, formatDate, formatTime } from "@/lib/utils";

type Props = {
  doctors: StaffUser[];
  services: Service[];
  initialDepartment?: Department;
  initialServiceId?: string;
  today: string;
};

type Slot = { time: string; available: boolean };

export function BookingForm({ doctors, services, initialDepartment = "dental", initialServiceId, today }: Props) {
  const [state, action, pending] = useActionState<BookingState, FormData>(bookAppointmentAction, null);
  const [department, setDepartment] = useState<Department>(initialDepartment);
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState(initialServiceId || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const departmentDoctors = useMemo(
    () => doctors.filter((doctor) => (department === "dental" ? doctor.role === "dentist" : doctor.role === "eye_doctor")),
    [doctors, department],
  );
  const departmentServices = useMemo(
    () => services.filter((service) => service.department === department),
    [services, department],
  );
  const selectedService = departmentServices.find((service) => service.id === serviceId);

  useEffect(() => {
    if (initialServiceId) setServiceId(initialServiceId);
  }, [initialServiceId]);

  function chooseDepartment(value: Department) {
    if (value === department) return;
    setDepartment(value);
    setDoctorId("");
    setServiceId("");
    setTime("");
  }

  useEffect(() => {
    let active = true;
    if (!doctorId || !date) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSlotsError(null);
    setTime("");
    availabilityAction(doctorId, date, selectedService?.duration_minutes || 30)
      .then((result) => {
        if (!active) return;
        setSlots(result);
        if (result.length === 0) setSlotsError("No clinic session is available for this doctor on the selected date.");
      })
      .catch(() => {
        if (active) setSlotsError("We could not load availability. Please try again.");
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [doctorId, date, selectedService?.duration_minutes]);

  if (state?.booking) {
    return (
      <div className="card overflow-hidden">
        <div className="bg-teal-600 px-6 py-7 text-white sm:px-8">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-2xl font-semibold">Your appointment is booked.</h2>
          <p className="mt-1.5 text-sm text-teal-50">Please keep your reference number handy.</p>
        </div>
        <div className="p-6 sm:p-8">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Appointment reference</p>
            <p className="mt-1 text-2xl font-bold tracking-[0.05em] text-navy-950">{state.booking.reference}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-navy-400">Date</dt>
                <dd className="mt-0.5 font-semibold text-navy-900">{formatDate(state.booking.date, { weekday: "long" })}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-navy-400">Time</dt>
                <dd className="mt-0.5 font-semibold text-navy-900">{formatTime(state.booking.time)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-navy-400">Department</dt>
                <dd className="mt-0.5 font-semibold capitalize text-navy-900">{state.booking.department}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-navy-400">Clinician</dt>
                <dd className="mt-0.5 font-semibold text-navy-900">{state.booking.doctorName}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-6 text-navy-600">
            <p className="flex items-start gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              Need to change something? Call <a href="tel:+254712345678" className="font-semibold text-navy-900">+254 712 345 678</a>.
            </p>
            <p className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              A confirmation has been queued to {state.booking.email || state.booking.phone}. Please arrive 10 minutes early.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/appointment" className="btn-primary">
              Find or cancel appointment
            </Link>
            <Link href="/" className="btn-secondary">
              Return to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{state.error}</p>
        </div>
      )}

      <section className="card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-navy-900">What do you need?</h2>
            <p className="mt-0.5 text-xs text-navy-500">Choose the department and service for your visit.</p>
          </div>
        </div>

        <input type="hidden" name="department" value={department} />
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="doctorId" value={doctorId} />
        <input type="hidden" name="time" value={time} />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { value: "dental" as Department, label: "Dental", text: "Teeth, gums and oral health", icon: Smile },
            { value: "optical" as Department, label: "Optical", text: "Vision and eye health", icon: Eye },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => chooseDepartment(item.value)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                department === item.value
                  ? item.value === "dental"
                    ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100"
                    : "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                  : "border-line bg-white hover:border-navy-200",
              )}
              aria-pressed={department === item.value}
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  item.value === "dental" ? "bg-teal-600 text-white" : "bg-sky-600 text-white",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-navy-900">{item.label}</span>
                <span className="mt-0.5 block text-xs text-navy-500">{item.text}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="serviceIdVisible" className="label">Service</label>
            <select
              id="serviceIdVisible"
              className="select"
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setTime("");
              }}
              required
            >
              <option value="">Select a service</option>
              {departmentServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes} min
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="doctorIdVisible" className="label">Preferred clinician</label>
            <select
              id="doctorIdVisible"
              className="select"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              required
            >
              <option value="">Select a clinician</option>
              {departmentDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}{doctor.title ? ` · ${doctor.title}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-navy-900">Choose a date and time</h2>
        <p className="mt-0.5 text-xs text-navy-500">Availability is checked against the clinician&apos;s schedule in real time.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <label htmlFor="appointmentDate" className="label">Appointment date</label>
            <input
              id="appointmentDate"
              name="date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setTime("");
              }}
              className="input"
              required
            />
          </div>
          <div>
            <span className="label">Available times</span>
            {!doctorId || !date ? (
              <div className="rounded-xl border border-dashed border-line bg-mist px-4 py-5 text-xs text-navy-500">
                Select a clinician and date to see available times.
              </div>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-mist px-4 py-5 text-xs text-navy-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking availability…
              </div>
            ) : slotsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-xs text-amber-800">{slotsError}</div>
            ) : slots.length > 0 ? (
              <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setTime(slot.time)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-semibold transition",
                      time === slot.time
                        ? "border-navy-900 bg-navy-900 text-white"
                        : slot.available
                          ? "border-line bg-white text-navy-700 hover:border-navy-300 hover:bg-navy-50"
                          : "cursor-not-allowed border-line bg-navy-50 text-navy-300 line-through",
                    )}
                    aria-pressed={time === slot.time}
                  >
                    {formatTime(slot.time)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-xs text-amber-800">
                No appointments are available for this date. Try another day.
              </div>
            )}
            {time && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Selected: {formatDate(date, { weekday: "short" })} at {formatTime(time)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-navy-900">Patient details</h2>
        <p className="mt-0.5 text-xs text-navy-500">We use these details to match you to your clinic record. No account is needed.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="fullName" className="label">Full name</label>
            <input id="fullName" name="fullName" className="input" autoComplete="name" required placeholder="e.g. Mary Wambui" />
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone number</label>
            <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" required placeholder="07xx xxx xxx" />
            <p className="mt-1 text-[11px] text-navy-400">Required. Used for confirmation and reminders.</p>
          </div>
          <div>
            <label htmlFor="email" className="label">Email address <span className="font-normal text-navy-400">(optional)</span></label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="dateOfBirth" className="label">Date of birth <span className="font-normal text-navy-400">(recommended)</span></label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" className="input" max={today} autoComplete="bday" />
          </div>
          <div>
            <label htmlFor="gender" className="label">Gender <span className="font-normal text-navy-400">(optional)</span></label>
            <select id="gender" name="gender" className="select">
              <option value="">Prefer not to say</option>
              <option>Female</option>
              <option>Male</option>
              <option>Intersex</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <span className="label">Have you visited Pioneer before?</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "new", label: "I am a new patient" },
                { value: "returning", label: "I am a returning patient" },
              ].map((option) => (
                <label key={option.value} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm text-navy-700 has-[:checked]:border-navy-900 has-[:checked]:bg-navy-50">
                  <input type="radio" name="patientType" value={option.value} defaultChecked={option.value === "new"} className="h-3.5 w-3.5 accent-navy-900" />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="reason" className="label">Reason for visit</label>
            <textarea id="reason" name="reason" className="textarea" required placeholder="Tell us briefly what brings you in today." />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="label">Additional notes <span className="font-normal text-navy-400">(optional)</span></label>
            <textarea id="notes" name="notes" className="textarea" placeholder="Accessibility needs, preferred language, or anything else we should know." />
          </div>
        </div>
        <label className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-mist p-3.5 text-xs leading-5 text-navy-600">
          <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />
          <span>
            I agree to Pioneer Family Dental and Optical Clinic processing my information to manage this appointment. I have read the{" "}
            <Link href="/privacy" className="font-semibold text-navy-900 underline">privacy notice</Link>.
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-[11px] text-navy-400">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Your information is stored securely and accessed only by your care team.
        </p>
        <button type="submit" className="btn-primary !min-h-12 !px-6" disabled={pending || !time || !serviceId || !doctorId}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Booking appointment…" : "Confirm appointment"}
        </button>
      </div>
    </form>
  );
}
