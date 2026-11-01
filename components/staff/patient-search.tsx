import { Search } from "lucide-react";

export function PatientSearch({
  action,
  defaultValue,
  placeholder = "Search by name, phone or patient number",
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          className="input !pl-9"
          placeholder={placeholder}
          aria-label="Search patients"
        />
      </div>
      <button type="submit" className="btn-primary shrink-0">
        <Search className="h-4 w-4" aria-hidden />
        Search
      </button>
    </form>
  );
}
