import Image from "next/image";
import Link from "next/link";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-yellow/10 via-transparent to-transparent" />
      
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-yellow/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-blue/5 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 text-center">
        <div className="animate-fade-in">
          <Image
            src="/logo.svg"
            alt="Harvest 21 Logo"
            width={280}
            height={60}
            priority
            className="h-16 sm:h-20 md:h-24 w-auto drop-shadow-[0_0_30px_rgba(211,175,55,0.3)]"
          />
        </div>
        
        <div className="animate-fade-in-up space-y-4" style={{ animationDelay: "0.2s" }}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight">
            Coming <span className="text-brand-yellow">Soon</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-md mx-auto">
            We&apos;re working on something amazing. Stay tuned!
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-8 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <div className="w-2 h-2 bg-brand-yellow rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 bg-brand-yellow rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 bg-brand-yellow rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
   
      </div>
    </div>
  );
}

