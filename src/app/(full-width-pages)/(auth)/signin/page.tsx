import { Metadata } from "next";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign In | Ticket Input Web",
  description: "Sign in to access Ticket Input Web",
};

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SignInForm />
    </div>
  );
}
