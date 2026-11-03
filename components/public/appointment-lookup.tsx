"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CalendarCheck, CheckCircle2, Clock, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";
import {
  cancelPublicAppointmentAction,
  lookupAppointmentAction,
  type LookupState,
} from "@/lib/actions/public";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatTime } from "@/lib/utils";

export function AppointmentLookup() {
  const [lookupState, lookupAction, lookupPending] = useActionState<LookupState, FormData>(
    lookupAppointmentAction,
    null,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState<LookupState, FormData>(
    cancelPublicAppointmentAction,
    null,
  );

  if (cancelState?.cancelled) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-navy-900">Appointment cancelled</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-navy-500">{cancelState.message}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/book" className="btn-primary">Book a new appointment</Link>
          <Link href="/" className="btn-secondary">Return home</Link>
        </div>
      </div>
    );
  }

  if (lookupState?.appointment) {
    const appt = lookupState.appointment;
    return (
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line bg-mist px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400">Appointment found</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">{appt.reference}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-navy-400">Patient</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-900">{appt.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-navy-400">Department</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-navy-900">{appt.department}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-navy-400">Date</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                <CalendarCheck className="h-4 w-4 text-teal-600" aria-hidden />
                {formatDate(appt.date, { weekday: "long" })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-navy-400">Time</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                <Clock className="h-4 w-4 text-teal-600" aria-hidden />
                {formatTime(appt.time)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-navy-400">Clinician</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-900">{appt.doctorName}</dd>
            </div>
          </dl>
          <div className="border-t border-line bg-white px-5 py-4 text-xs leading-5 text-navy-500">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
              For privacy, this page only shows appointment details after verifying the reference, name and phone number.
            </p>
          </div>
        </div>

        {cancelState?.error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {cancelState.error}
          </div>
        )}

        {appt.cancellable ? (
          <form
            action={cancelAction}
            onSubmit={(event) => {
              if (!window.confirm("Cancel this appointment? This cannot be undone online.")) event.preventDefault();
            }}
            className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <input type="hidden" name="reference" value={appt.reference} />
            <input type="hidden" name="fullName" value={appt.fullName} />
            <input type="hidden" name="phone" value={appt.phone} />
            <div>
              <p className="text-sm font-semibold text-navy-900">Need to cancel?</p>
              <p className="mt-1 text-xs text-navy-500">You can cancel online while the appointment is still booked or confirmed.</p>
            </div>
            <button type="submit" className="btn-danger shrink-0" disabled={cancelPending}>
              {cancelPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
              {cancelPending ? "Cancelling…" : "Cancel appointment"}
            </button>
          </form>
        ) : (
          <p className="rounded-xl border border-line bg-mist p-4 text-xs leading-5 text-navy-500">
            This appointment can no longer be cancelled online. Please call the clinic on <a href="tel:+254705188578" className="font-semibold text-navy-800">+254 705 188 578</a>.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={lookupAction} className="card p-5 sm:p-6">
      {lookupState?.error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {lookupState.error}
        </div>
      )}
      <div className="grid gap-4">
        <div>
          <label htmlFor="lookupReference" className="label">Appointment reference</label>
          <input id="lookupReference" name="reference" className="input uppercase" placeholder="PF-20261031-ABCD" autoComplete="off" required />
        </div>
        <div>
          <label htmlFor="lookupName" className="label">Full name used for the booking</label>
          <input id="lookupName" name="fullName" className="input" autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="lookupPhone" className="label">Phone number used for the booking</label>
          <input id="lookupPhone" name="phone" type="tel" className="input" autoComplete="tel" required />
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-mist p-3 text-[11px] leading-5 text-navy-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
        We require all three details so a phone number alone cannot reveal appointment information.
      </p>
      <button type="submit" className="btn-primary mt-5 w-full" disabled={lookupPending}>
        {lookupPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
        {lookupPending ? "Verifying…" : "Find my appointment"}
      </button>
    </form>
  );
}
