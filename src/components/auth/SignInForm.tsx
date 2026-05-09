"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        setError("Invalid username or password");
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred during sign in");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col flex-1 w-full min-h-screen overflow-hidden lg:w-1/2">  
      <div className="relative z-10 flex flex-col flex-1 w-full">
        
        {/* Back Button */}
        <div className="w-full max-w-md pt-8 mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
        </div>

        {/* Login Card */}
        <div className="flex items-center justify-center flex-1 px-6 py-10">
          <div className="w-full max-w-md">
            
            <div className="overflow-hidden border border-gray-200 shadow-2xl rounded-3xl bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              
              {/* Header */}
              <div className="px-8 pt-10 pb-6 text-center border-b border-gray-100 dark:border-white/10">
                
                {/* Logo */}
                <div className="flex items-center justify-center w-20 h-20 mx-auto mb-5 rounded-2xl bg-brand-500/10 text-brand-500 dark:bg-brand-500/20">
                  <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-10 h-10"
                  >
                    <rect
                      width="48"
                      height="48"
                      rx="12"
                      fill="currentColor"
                      fillOpacity="0.15"
                    />
                    <path
                      d="M14 12h13l7 7v17H14V12z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M27 12v7h7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="18"
                      y="24"
                      width="12"
                      height="2"
                      rx="1"
                      fill="currentColor"
                    />
                    <rect
                      x="18"
                      y="29"
                      width="8"
                      height="2"
                      rx="1"
                      fill="currentColor"
                      opacity="0.7"
                    />
                  </svg>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 dark:text-white/90">
                  Welcome Back
                </h1>

                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  Silakan login menggunakan username dan password untuk melanjutkan akses dashboard.
                </p>
              </div>

              {/* Form */}
              <div className="px-8 py-8">
                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">

                    {/* Error */}
                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                        {error}
                      </div>
                    )}

                    {/* Username */}
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Username
                      </Label>

                      <div className="relative">
                        <Input
                          placeholder="Masukkan username"
                          type="text"
                          value={username}
                          onChange={(e: any) => setUsername(e.target.value)}
                          required
                          className="h-12 rounded-xl border-gray-300 bg-transparent px-4 text-sm focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />

                        <div className="absolute inset-y-0 right-4 flex items-center text-gray-400">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M5.121 17.804A9.969 9.969 0 0112 15c2.21 0 4.253.714 5.879 1.922M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                      </Label>

                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Masukkan password"
                          value={password}
                          onChange={(e: any) => setPassword(e.target.value)}
                          required
                          className="h-12 rounded-xl border-gray-300 bg-transparent px-4 pr-12 text-sm focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-4 flex items-center text-gray-400 transition hover:text-brand-500"
                        >
                          {showPassword ? (
                            <EyeIcon className="w-5 h-5 fill-current" />
                          ) : (
                            <EyeCloseIcon className="w-5 h-5 fill-current" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-2">
                      <Button
                        className="w-full h-12 rounded-xl bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
                        size="sm"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                            Memproses...
                          </div>
                        ) : (
                          "Masuk ke Dashboard"
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="px-8 py-4 text-center border-t border-gray-100 dark:border-white/10">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Secure Dashboard Access • Modern Admin Panel
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
