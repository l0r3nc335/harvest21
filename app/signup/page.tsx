import { Suspense } from "react";
import { SupporterSignUpForm } from "./SupporterSignUpForm";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded"></div>
          <div className="h-12 bg-zinc-800 rounded"></div>
          <div className="h-12 bg-zinc-800 rounded"></div>
          <div className="h-12 bg-zinc-800 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <SupporterSignUpForm />
      </Suspense>
    </div>
  );
}

