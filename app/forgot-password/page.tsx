import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import Image from "next/image";
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-50 to-zinc-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center flex flex-row justify-center items-center mb-8">
            <Image src="/logo.svg" alt="Harvest21 Logo" width={300} height={100} />
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

