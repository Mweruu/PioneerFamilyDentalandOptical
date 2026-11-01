import { AlertCircle, CheckCircle2 } from "lucide-react";

export function Flash({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div className="mb-5 space-y-2">
      {success && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-5 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{success}</p>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs leading-5 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
