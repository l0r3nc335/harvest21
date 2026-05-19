export function SocialMediaPlatformCardSkeleton() {
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
      <div className="h-4 w-56 rounded bg-white/10 animate-pulse" />
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="h-9 w-36 rounded-md bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

export function SocialMediaRecentCrossPostsSkeleton() {
  return (
    <ul className="mt-2 space-y-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex justify-between gap-2 border-b border-white/5 pb-2">
          <div className="h-4 max-w-[220px] flex-1 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-16 shrink-0 rounded bg-white/10 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

export function MessagesConversationsSkeleton() {
  return (
    <div className="divide-y divide-zinc-100 border-t border-zinc-100" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-200 animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-44 rounded bg-zinc-200 animate-pulse" />
            <div className="h-3 w-full max-w-md rounded bg-zinc-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
