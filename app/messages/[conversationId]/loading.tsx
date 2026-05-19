export default function ConversationLoading() {
  return (
    <div className="h-screen flex bg-zinc-50">
      <div className="flex flex-col w-full lg:w-96 bg-white border-r border-zinc-200" />
      <div className="flex-1 flex flex-col bg-white items-center justify-center min-w-0">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin" />
      </div>
    </div>
  );
}
