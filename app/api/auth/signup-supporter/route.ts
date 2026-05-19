import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { signupSupporterSchema, parseBody } from "@/lib/validations";
import { logSecurityEvent } from "@/lib/securityLogger";
import { checkPassword, passwordStrengthMessage } from "@/lib/passwordSecurity";
import { reportServerError } from "@/lib/errorReporting";

const cookieOptions = {
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  httpOnly: true,
};

export async function POST(request: NextRequest) {
  try {
    // Security: rate limit signup to prevent abuse
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "auth");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/auth/signup-supporter", method: "POST" });
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = parseBody(signupSupporterSchema, body);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", { ip, path: "/api/auth/signup-supporter", detail: parsed.error });
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { firstName, lastName, email, password, countryOfResidence } = parsed.data;

    const pwCheck = await checkPassword(password, [email, firstName, lastName]);
    if (!pwCheck.ok) {
      logSecurityEvent("input_validation_failure", {
        ip,
        path: "/api/auth/signup-supporter",
        detail: `password_rejected:${pwCheck.reason}`,
      });
      return NextResponse.json(
        { error: passwordStrengthMessage(pwCheck) },
        { status: 400 }
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
            }
          },
        },
      }
    );

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });

    if (authError) {
      const authErrorCode =
        authError instanceof AuthError ? authError.code : undefined;
      reportServerError(authError, {
        path: "/api/auth/signup-supporter",
        method: "POST",
        ip,
        extra: { code: authErrorCode },
      });

      const genericMessage =
        authErrorCode === "user_already_exists"
          ? "An account with that email already exists."
          : "We could not create your account. Please try again.";
      return NextResponse.json({ error: genericMessage }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    const userId = authData.user.id;
    const supporterRoleId = 4;

    const { error: userError } = await supabase
      .from("users")
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email: email,
        role: supporterRoleId,
        status: "Active",
      });

    if (userError) {
      reportServerError(userError, {
        path: "/api/auth/signup-supporter",
        method: "POST",
        userId,
        extra: { step: "insert_users" },
      });
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    // Set initial last_activity for new user
    await supabase
      .from("users")
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const { error: profileError } = await supabase
      .from("supporter_profiles")
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email: email,
        country_of_residence: countryOfResidence,
      });

    if (profileError) {
      reportServerError(profileError, {
        path: "/api/auth/signup-supporter",
        method: "POST",
        userId,
        extra: { step: "insert_supporter_profile" },
      });
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Failed to create supporter profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Account created successfully. Please check your email to confirm your account.",
      user: { id: authData.user.id, email: authData.user.email },
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/auth/signup-supporter",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to create account", incidentId },
      { status: 500 }
    );
  }
}

