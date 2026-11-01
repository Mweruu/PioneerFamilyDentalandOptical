export function formatKes(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPhone(value: string | null | undefined) {
  if (!value) return "—";
  return value;
}
