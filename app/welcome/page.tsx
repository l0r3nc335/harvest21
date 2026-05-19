import { Suspense } from "react";
import WelcomePageContent from "@/components/auth/WelcomePageContent";

export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <WelcomePageContent />
    </Suspense>
  );
}

