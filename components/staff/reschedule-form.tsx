"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { availabilityAction } from "@/lib/actions/public";
import { rescheduleAppointmentAction } from "@/lib/actions/reception";
import type { Appointment } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

type Slot = { time: string; available: boolean };

export function RescheduleForm({ appointment, today }: { appointment: Appointment; today: string }) {
  const [date, setDate] = useState(appointment.appointment_date);
  const [time, setTime] = useState(appointment.appointment_time);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!date) return;
    setLoading(true);
    setError(null);
    availabilityAction(appointment.doctor_id, date, appointment.duration_minutes)
      .then((result) => {
        if (!active) return;
        setSlots(result);
        if (!result.length) setError("No clinic session is available for this clinician on that date.");
      })
      .catch(() => active && setError("Could not load availability."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [appointment.doctor_id, appointment.duration_minutes, date]);

  return (
    <form action={rescheduleAppointmentAction} className="space-y-4">
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <input type="hidden" name="returnTo" value={`/staff/receptionist/appointments/${appointment.id}`} />
      <input type="hidden" name="time" value={time} />

      <div>
        <label htmlFor="rescheduleDate" className="label">New date</label>
        <input
          id="rescheduleDate"
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
        <span className="label">Available times</span>
        {loading ? (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-mist px-3 py-3 text-xs text-navy-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…
          </p>
        ) : error ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">{error}</p>
        ) : (
          <div className="grid max-h-36 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
            {slots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => setTime(slot.time)}
                aria-pressed={time === slot.time}
                className={cn(
                  "rounded-lg border px-1.5 py-1.5 text-[11px] font-semibold transition",
                  time === slot.time
                    ? "border-navy-900 bg-navy-900 text-white"
                    : slot.available
                      ? "border-line bg-white text-navy-700 hover:border-navy-300"
                      : "cursor-not-allowed border-line bg-navy-50 text-navy-300 line-through",
                )}
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="submit" className="btn-secondary w-full" disabled={!time || loading}>
        <CalendarClock className="h-4 w-4" aria-hidden />
        Confirm new time
      </button>
    </form>
  );
}
