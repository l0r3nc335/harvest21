import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { logSecurityEvent } from "@/lib/securityLogger";

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface AuthorizedUser extends AuthenticatedUser {
  role: number;
}

export const ADMIN_ROLE_IDS = [1, 2] as const;
export const STAFF_ROLE_IDS = [1, 2] as const;

export async function requireAuth(): Promise<AuthenticatedUser | NextResponse> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logSecurityEvent("auth_failure", { detail: "No authenticated session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { id: user.id, email: user.email };
}

/**
 * Loads the current user + their role row, enforcing the caller's role is
 * one of the allowed IDs. Returns a 401 if unauthenticated, 403 if
 * authenticated but not authorized.
 *
 * Use this as the FIRST line of every Server Action or Route Handler that
 * performs privileged operations.
 */
export async function requireRole(
  allowedRoles: readonly number[]
): Promise<AuthorizedUser | NextResponse> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logSecurityEvent("auth_failure", { detail: "No authenticated session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = userRow?.role as number | undefined;
  if (!role || !allowedRoles.includes(role)) {
    logSecurityEvent("forbidden_access", {
      userId: user.id,
      detail: `role_required:${allowedRoles.join(",")};actual:${role ?? "none"}`,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { id: user.id, email: user.email, role };
}

export async function requireAdminOrStaff(): Promise<AuthorizedUser | NextResponse> {
  return requireRole(ADMIN_ROLE_IDS);
}

export async function requireAdmin(): Promise<AuthorizedUser | NextResponse> {
  return requireRole([1]);
}

/**
 * Thin wrappers for Server Actions where callers prefer throw-based control
 * flow over `instanceof NextResponse` checks. Throws a structured error that
 * Server Action runtime will surface as a failed action result.
 */
export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export async function assertAdminOrStaff(): Promise<AuthorizedUser> {
  const result = await requireAdminOrStaff();
  if (result instanceof NextResponse) {
    const status = result.status;
    throw new AuthorizationError(
      status === 401 ? "Unauthorized" : "Forbidden",
      status
    );
  }
  return result;
}

export async function assertAuth(): Promise<AuthenticatedUser> {
  const result = await requireAuth();
  if (result instanceof NextResponse) {
    const status = result.status;
    throw new AuthorizationError(
      status === 401 ? "Unauthorized" : "Forbidden",
      status
    );
  }
  return result;
}

export type OrganizationType =
  | "missionary"
  | "church"
  | "agency"
  | "college"
  | "donor";

async function lookupOrgOwner(
  orgType: OrganizationType,
  orgId: number
): Promise<string | null> {
  const supabase = await getSupabaseServer();
  if (orgType === "missionary") {
    const { data } = await supabase
      .from("missionaries")
      .select("user_id")
      .eq("id", orgId)
      .maybeSingle();
    return (data?.user_id as string | null) ?? null;
  }
  if (orgType === "donor") {
    const { data } = await supabase
      .from("donors")
      .select("user_id")
      .eq("id", orgId)
      .maybeSingle();
    return (data?.user_id as string | null) ?? null;
  }
  const table =
    orgType === "church"
      ? "churches"
      : orgType === "agency"
        ? "agencies"
        : "colleges";
  const { data } = await supabase
    .from(table)
    .select("contact_user_id")
    .eq("id", orgId)
    .maybeSingle();
  return (data?.contact_user_id as string | null) ?? null;
}

export async function requirePageOwnership(
  userId: string,
  pageId: number
): Promise<true | NextResponse> {
  const supabase = await getSupabaseServer();

  const { data: page } = await supabase
    .from("pages")
    .select("organization_type, organization_id")
    .eq("id", pageId)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const ownerUserId = await lookupOrgOwner(
    page.organization_type as OrganizationType,
    page.organization_id as number
  );

  if (ownerUserId !== userId) {
    logSecurityEvent("forbidden_access", {
      userId,
      detail: `Page ${pageId} ownership denied`,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return true;
}

/**
 * Ensures caller is authenticated AND (owns the given organization OR is
 * admin/staff). Throws AuthorizationError otherwise. Used by pageActions
 * where page owners and admins both need access.
 */
export async function assertOrgOwnerOrStaff(
  orgType: OrganizationType,
  orgId: number
): Promise<AuthorizedUser | AuthenticatedUser> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logSecurityEvent("auth_failure", { detail: "No authenticated session" });
    throw new AuthorizationError("Unauthorized", 401);
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (userRow?.role as number | undefined) ?? 0;
  const isStaff = ADMIN_ROLE_IDS.includes(role as 1 | 2);
  if (isStaff) {
    return { id: user.id, email: user.email, role };
  }

  const ownerUserId = await lookupOrgOwner(orgType, orgId);
  if (ownerUserId !== user.id) {
    logSecurityEvent("forbidden_access", {
      userId: user.id,
      detail: `${orgType}:${orgId} ownership denied`,
    });
    throw new AuthorizationError("Forbidden", 403);
  }
  return { id: user.id, email: user.email };
}

export async function assertPageOwnerOrStaff(
  pageId: number
): Promise<AuthorizedUser | AuthenticatedUser> {
  const supabase = await getSupabaseServer();
  const { data: page } = await supabase
    .from("pages")
    .select("organization_type, organization_id")
    .eq("id", pageId)
    .maybeSingle();

  if (!page) {
    throw new AuthorizationError("Page not found", 404);
  }

  return assertOrgOwnerOrStaff(
    page.organization_type as OrganizationType,
    page.organization_id as number
  );
}
