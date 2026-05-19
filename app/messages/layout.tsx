import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getConversations } from "./message-actions";
import { MessagesShell } from "@/components/messaging/MessagesShell";
import { getUserProfile } from "@/lib/navbarHelpers";
import { getUnreadNotificationCount } from "@/lib/notificationHelpers";

export const metadata = {
  title: "Messages | Harvest21",
  description: "Your direct messages",
};

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const result = await getConversations();
  const userProfile = await getUserProfile();
  const unreadCount = userProfile ? await getUnreadNotificationCount() : 0;

  if (!result.success) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-500 font-medium">Failed to load conversations</p>
          <p className="text-sm text-zinc-500 mt-2">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <MessagesShell
      initialConversations={result.data}
      currentUserId={user.id}
      initialUserProfile={userProfile}
      initialUnreadCount={unreadCount}
    />
  );
}
