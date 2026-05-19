import Image from 'next/image'

export const dynamic = 'force-dynamic'

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#000000] font-sans">
      <div className="mx-auto max-w-md px-6 text-center">
        <Image
          src="/logo.svg"
          alt="Harvest21"
          width={400}
          height={120}
          className="mx-auto mb-8"
          priority
        />
        <h1 className="text-3xl font-semibold text-white">
          We&apos;ll be back soon
        </h1>
        <p className="mt-4 text-lg text-zinc-400">
          We&apos;re performing scheduled maintenance. Please check back shortly.
        </p>
      </div>
    </div>
  )
}
