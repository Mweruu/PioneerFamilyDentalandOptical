import "server-only";
import { redirect } from "next/navigation";

export function text(formData: FormData, key: string, max = 5000) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function optionalText(formData: FormData, key: string, max = 5000) {
  const value = text(formData, key, max);
  return value.length ? value : null;
}

export function checkbox(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key, 30);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function intOrNull(formData: FormData, key: string) {
  const value = numberOrNull(formData, key);
  return value === null ? null : Math.round(value);
}

export function multiText(formData: FormData, key: string, max = 1000) {
  const values = formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().slice(0, max));
  return values;
}

export function withQuery(path: string, params: Record<string, string | null | undefined>) {
  const [base, existing] = path.split("?");
  const search = new URLSearchParams(existing ?? "");
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") search.delete(key);
    else search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function redirectError(path: string, message: string): never {
  redirect(withQuery(path, { error: message.slice(0, 400) }));
}

export function redirectSuccess(path: string, message?: string): never {
  redirect(withQuery(path, { success: message?.slice(0, 400) }));
}

export function formReturnPath(formData: FormData, fallback: string) {
  const value = text(formData, "returnTo", 300);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
