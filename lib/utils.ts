import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CLINIC_TIME_ZONE = "Africa/Nairobi";

export function clinicToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A clinic-local date offset by whole days, as `YYYY-MM-DD`. */
export function clinicDatePlus(days: number): string {
  const base = new Date(`${clinicToday()}T12:00:00+03:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDate(value: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: CLINIC_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: CLINIC_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function ageFromDob(dob: string | null | undefined) {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export function calculateBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  const metres = heightCm / 100;
  if (metres <= 0) return null;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function reference(prefix = "PF") {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

export function minutesFromTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function addMinutesToTime(time: string, minutes: number) {
  const total = minutesFromTime(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function weekdayNumber(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

export function timeSlots(start: string, end: string, duration: number, breakStart?: string | null, breakEnd?: string | null) {
  const slots: string[] = [];
  const breakS = breakStart ? minutesFromTime(breakStart) : null;
  const breakE = breakEnd ? minutesFromTime(breakEnd) : null;
  for (let t = minutesFromTime(start); t + duration <= minutesFromTime(end); t += duration) {
    if (breakS !== null && breakE !== null && t < breakE && t + duration > breakS) continue;
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

export function isFutureAppointment(date: string, time: string) {
  const dt = new Date(`${date}T${time}:00`);
  return dt.getTime() > Date.now();
}

export function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
