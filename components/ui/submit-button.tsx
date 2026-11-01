"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={cn("btn-primary", className)} disabled={pending || disabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}
