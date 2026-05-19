export default function MessagesLoading() {
  return (
    <div className="h-screen flex bg-zinc-50">
      <div className="flex flex-col w-full lg:w-96 bg-white border-r border-zinc-200">
        <div className="p-4 border-b border-zinc-200">
          <div className="h-8 w-32 bg-zinc-200 rounded animate-pulse mb-4" />
          <div className="h-10 bg-zinc-100 rounded-full animate-pulse mb-3" />
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-zinc-100 rounded-full animate-pulse" />
            <div className="h-8 w-20 bg-zinc-100 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 items-center p-3">
              <div className="w-14 h-14 rounded-full bg-zinc-200 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-32 bg-zinc-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-full max-w-48 bg-zinc-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 hidden lg:flex items-center justify-center bg-white">
        <div className="w-24 h-24 rounded-full bg-zinc-100 animate-pulse" />
      </div>
    </div>
  );
}
