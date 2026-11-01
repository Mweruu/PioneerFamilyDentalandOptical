"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfirmSubmit({
  children,
  message,
  className,
  pendingText = "Working…",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn("btn-secondary", className)}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}
