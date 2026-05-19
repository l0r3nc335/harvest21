import { Navbar } from "@/components/Navbar";
import { getUserProfile } from "@/lib/navbarHelpers";
import { getUnreadNotificationCount } from "@/lib/notificationHelpers";

export async function NavbarWrapper() {
  const userProfile = await getUserProfile();
  const unreadCount = userProfile ? await getUnreadNotificationCount() : 0;
  
  return <Navbar initialUserProfile={userProfile} initialUnreadCount={unreadCount} />;
}

