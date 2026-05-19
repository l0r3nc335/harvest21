export function MissionariesLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-black pb-16">
      {/* Header Section Skeleton */}
      <div className="border-b border-white/10 bg-black/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-2 h-10 w-64 animate-pulse rounded bg-zinc-800/50" />
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-800/50" />
        </div>
      </div>

      {/* Controls Section Skeleton */}
      <div className="sticky top-16 z-20 border-b border-white/10 bg-black/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar Skeleton */}
            <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-zinc-800/50" />
            
            {/* Controls Skeleton */}
            <div className="flex flex-wrap gap-3">
              <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-800/50" />
              <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-800/50" />
              <div className="h-10 w-24 animate-pulse rounded-lg bg-zinc-800/50" />
            </div>
          </div>
        </div>
      </div>

      {/* Missionaries Grid Skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900/50"
            >
              {/* Image Skeleton */}
              <div className="aspect-[3/4] w-full animate-pulse bg-zinc-800/50" />
              
              {/* Content Skeleton */}
              <div className="p-4">
                <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-zinc-800/50" />
                <div className="mb-4 h-4 w-1/2 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-3 w-full animate-pulse rounded bg-zinc-800/50" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

