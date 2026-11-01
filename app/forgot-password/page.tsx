import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Reset Staff Password",
  description: "Request a password reset link for your Pioneer Clinic staff account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your work email and we will queue a secure reset link. The link expires after 30 minutes."
      footer="For privacy, we show the same confirmation whether or not an active account exists."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
