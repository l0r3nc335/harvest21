import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { updateUserLastActivity } from "@/lib/userActivityHelpers";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { signinSchema, parseBody } from "@/lib/validations";
import { logSecurityEvent } from "@/lib/securityLogger";

const cookieOptions = {
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  httpOnly: true,
};

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "auth");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/auth/signin", method: "POST" });
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = parseBody(signinSchema, body);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", { ip, path: "/api/auth/signin", detail: parsed.error });
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const emailKey = `email:${email.toLowerCase()}`;
    const { success: withinEmailLimit } = await rateLimitCheck(emailKey, "auth");
    if (!withinEmailLimit) {
      logSecurityEvent("rate_limit_hit", {
        ip,
        path: "/api/auth/signin",
        method: "POST",
        detail: "email_keyed",
      });
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, { ...cookieOptions, ...options });
              });
            } catch {
              // Ignore errors
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logSecurityEvent("auth_failure", { ip, path: "/api/auth/signin", detail: "Invalid credentials" });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("status")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (userError) {
      const { reportServerError } = await import("@/lib/errorReporting");
      reportServerError(userError, { path: "/api/auth/signin", method: "POST", userId: data.user.id });
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Failed to verify account status" },
        { status: 500 }
      );
    }

    if (userData?.status === "Inactive") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { 
          error: "Your account has been disabled. Please contact the administrator for assistance.",
          accountDisabled: true
        },
        { status: 403 }
      );
    }

    // Update last_activity in the users table (public.users, not auth.users)
    // Join relationship: public.users.user_id = auth.users.id
    // This updates the last_activity timestamp field when user logs in
    try {
      await updateUserLastActivity(data.user.id, true);
    } catch (activityError) {
      const { reportServerError } = await import("@/lib/errorReporting");
      reportServerError(activityError, {
        path: "/api/auth/signin",
        method: "POST",
        userId: data.user.id,
        extra: { detail: "update_last_activity_failed" },
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    const { reportServerError } = await import("@/lib/errorReporting");
    const { incidentId } = reportServerError(error, {
      path: "/api/auth/signin",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to sign in", incidentId },
      { status: 500 }
    );
  }
}

