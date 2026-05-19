"use client";
import Link from "next/link";
import { ReactNode, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building,
  Church,
  GraduationCap,
  Receipt,
  UserCircle,
  UserCog,
  User,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Settings,
  Flag,
  LayoutList,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import Image from "next/image";

type AuthSession = Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];
type SessionUser = NonNullable<AuthSession>["user"];

const navigationItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, disabled: false },
  { href: "/admin/homepage-settings", label: "Homepage Settings", icon: Settings, disabled: false },
  { href: "/admin/featured-sections", label: "Featured Sections", icon: LayoutList, disabled: false },
  { href: "/admin/missionaries", label: "Missionaries", icon: Users, disabled: false },
  { href: "/admin/agencies", label: "Agencies", icon: Building, disabled: false },
  { href: "/admin/churches", label: "Churches", icon: Church, disabled: false },
  { href: "/admin/colleges", label: "Colleges", icon: GraduationCap, disabled: false },
  { href: "/admin/message-reports", label: "Message Reports", icon: Flag, disabled: false },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt, disabled: false },
  { href: "/admin/users", label: "Users", icon: UserCog, disabled: false },
  { href: "/admin/settings", label: "Account", icon: User, disabled: false },
];

export default function AdminLayout({ 
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: AuthSession) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsDrawerOpen(false);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const toastId = toast.loading("Signing out...");

    try {
      await supabase.auth.signOut();
      
      await fetch('/api/auth/signout', { method: 'POST' });

      toast.success("Successfully signed out!", { id: toastId });
      window.location.href = "/";
    } catch {
      toast.error("An unexpected error occurred", { id: toastId });
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen bg-white text-zinc-900 overflow-hidden">
      <div className="grid h-screen grid-cols-1 xl:grid-cols-[240px_1fr]">
        {isDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        <aside
          className={`fixed xl:static inset-y-0 left-0 z-50 xl:z-auto flex flex-col h-screen w-64 xl:w-auto border-r border-zinc-200 bg-zinc-50 overflow-hidden transition-transform duration-300 ease-in-out shadow-xl xl:shadow-none ${
            isDrawerOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
          }`}
        >
          <div className="p-6 shrink-0 flex items-center justify-between">
            <Link 
              href="/" 
              className="block text-xl font-semibold tracking-tight text-blue-600"
              onClick={() => setIsDrawerOpen(false)}
            >
              <Image src="/logo.svg" alt="Harvest" width={200} height={100} />
            </Link>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="xl:hidden p-2 text-zinc-700 hover:bg-zinc-100 rounded-md"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="px-4 py-2 text-sm flex-1 overflow-hidden">
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                let isActive = false;
                if (item.href === "/admin") {
                  isActive = pathname === "/admin";
                } else if (item.href === "/admin/settings") {
                  isActive = pathname === "/admin/settings";
                } else {
                  isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                }
                return (
                  <li key={item.href}>
                    {item.disabled ? (
                      <div
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-400 cursor-not-allowed opacity-50"
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setIsDrawerOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                          isActive
                            ? "bg-[#D3AF37] text-black font-medium"
                            : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="p-4 border-t border-zinc-200 shrink-0">
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                handleLogout();
              }}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="h-5 w-5" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </aside>

        <main className="flex h-screen flex-col overflow-hidden">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white shrink-0">
            <div className="flex items-center justify-between px-6 py-4">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="xl:hidden p-2 text-zinc-700 hover:bg-zinc-100 rounded-md cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>

              <div className="flex flex-1 justify-end items-center gap-4">
                <button className="flex items-center gap-2 p-2 text-zinc-700 hover:text-zinc-900 cursor-pointer">
                  <Avatar
                    size="sm"
                    src="https://ui-avatars.com/api/?name=User&background=random&color=fff&size=128"
                    alt="User"
                    fallback="U"
                  />
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 bg-white overflow-y-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
