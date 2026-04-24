import { Metadata } from "next";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export const metadata: Metadata = {
  title: "Sign In | Ticket Input Web",
  description: "Sign in with Google to access Ticket Input Web",
};

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Sign in to access your dashboard
          </p>
        </div>
        <GoogleSignInButton />
      </div>
    </div>
  );
}
