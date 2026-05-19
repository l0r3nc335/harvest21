import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { updateUserLastActivity } from "@/lib/userActivityHelpers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore errors
            }
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);
    
    // Update last_activity after successful OAuth authentication
    // Join relationship: public.users.user_id = auth.users.id
    if (session?.user?.id) {
      await updateUserLastActivity(session.user.id, true);
    }
  }

  return NextResponse.redirect(`${origin}`);
}

