import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

function ResetPasswordFormFallback() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Loading...</h2>
        <p className="text-zinc-600">Please wait while we load the form.</p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">
            <span className="text-blue-400">H</span>arvest21
          </h1>
          <p className="text-zinc-600">Create a new password</p>
        </div>
        
        <Suspense fallback={<ResetPasswordFormFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

