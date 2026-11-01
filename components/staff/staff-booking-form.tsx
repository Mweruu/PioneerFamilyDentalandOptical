"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, Loader2 } from "lucide-react";
import { availabilityAction } from "@/lib/actions/public";
import { createAppointmentAction } from "@/lib/actions/reception";
import type { Department, Patient, Service, StaffUser } from "@/lib/types";
import { cn, formatDate, formatTime } from "@/lib/utils";

type Slot = { time: string; available: boolean };

export function StaffBookingForm({
  patient,
  doctors,
  services,
  today,
  initialDepartment = "dental",
}: {
  patient: Patient;
  doctors: StaffUser[];
  services: Service[];
  today: string;
  initialDepartment?: Department;
}) {
  const [department, setDepartment] = useState<Department>(initialDepartment);
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setSlotsError(null);
    setTime("");
    availabilityAction(doctorId, date, selectedService?.duration_minutes || 30)
      .then((result) => {
        if (!active) return;
        setSlots(result);
        if (!result.length) setSlotsError("No clinic session is available for this clinician on that date.");
      })
      .catch(() => active && setSlotsError("Could not load availability. Try again."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [doctorId, date, selectedService?.duration_minutes]);

  return (
    <form action={createAppointmentAction} className="space-y-5">
      <input type="hidden" name="patientId" value={patient.id} />
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="time" value={time} />

      <div>
        <span className="label">Department</span>
        <div className="grid grid-cols-2 gap-2">
          {(["dental", "optical"] as Department[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseDepartment(value)}
              aria-pressed={department === value}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition",
                department === value
                  ? value === "dental"
                    ? "border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-100"
                    : "border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-100"
                  : "border-line bg-white text-navy-600 hover:border-navy-200",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="staffService" className="label">Service</label>
          <select
            id="staffService"
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
              <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="staffDoctor" className="label">Clinician</label>
          <select id="staffDoctor" className="select" value={doctorId} onChange={(event) => setDoctorId(event.target.value)} required>
            <option value="">Select a clinician</option>
            {departmentDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="staffDate" className="label">Date</label>
          <input
            id="staffDate"
            name="date"
            type="date"
            className="input"
            min={today}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setTime("");
            }}
            required
          />
        </div>
        <div>
          <label htmlFor="staffReason" className="label">Reason for visit</label>
          <input id="staffReason" name="reason" className="input" placeholder="e.g. Follow-up on lower right molar" required />
        </div>
      </div>

      <div>
        <span className="label">Available times</span>
        {!doctorId ? (
          <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-5 text-xs text-navy-500">
            Select a clinician to see their availability.
          </p>
        ) : loading ? (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-mist px-4 py-5 text-xs text-navy-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking availability…
          </p>
        ) : slotsError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-xs text-amber-800">{slotsError}</p>
        ) : (
          <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
            {slots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => setTime(slot.time)}
                aria-pressed={time === slot.time}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-semibold transition",
                  time === slot.time
                    ? "border-navy-900 bg-navy-900 text-white"
                    : slot.available
                      ? "border-line bg-white text-navy-700 hover:border-navy-300 hover:bg-navy-50"
                      : "cursor-not-allowed border-line bg-navy-50 text-navy-300 line-through",
                )}
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>
        )}
        {time && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-700">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatDate(date, { weekday: "short" })} at {formatTime(time)}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="staffPatientType" className="label">Patient type</label>
          <select id="staffPatientType" name="patientType" className="select" defaultValue="returning">
            <option value="returning">Returning patient</option>
            <option value="new">New patient</option>
          </select>
        </div>
        <div>
          <label htmlFor="staffNotes" className="label">Internal notes <span className="font-normal text-navy-400">(optional)</span></label>
          <input id="staffNotes" name="notes" className="input" placeholder="Visible to staff only" />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={!time || !serviceId || !doctorId}>
        <CalendarCheck className="h-4 w-4" aria-hidden />
        Book appointment
      </button>
    </form>
  );
}
