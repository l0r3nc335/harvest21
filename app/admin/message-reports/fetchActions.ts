"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";

export type MessageReportRow = {
  id: number;
  conversation_id: number;
  message_id: number | null;
  reported_by: string;
  report_type: "message" | "conversation";
  reason: string | null;
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
  reporter_name: string;
  missionary_name: string;
  supporter_name: string;
  message_content: string | null;
  message_created_at: string | null;
};

export async function fetchMessageReports(): Promise<MessageReportRow[]> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  const { data: reports, error: reportsError } = await supabase
    .from("message_reports")
    .select("id, conversation_id, message_id, reported_by, report_type, reason, status, created_at")
    .order("created_at", { ascending: false });

  if (reportsError) {
    console.error("Error fetching message reports:", reportsError);
    return [];
  }

  if (!reports || reports.length === 0) return [];

  const convIds = [...new Set((reports as { conversation_id: number }[]).map((r) => r.conversation_id))];
  const msgIds = (reports as { message_id: number | null }[])
    .map((r) => r.message_id)
    .filter((id): id is number => id != null);
  const userIds = new Set<string>();
  (reports as { reported_by: string }[]).forEach((r) => userIds.add(r.reported_by));

  const [{ data: convData }, { data: msgData }, { data: usersData }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, missionary_id, supporter_id")
      .in("id", convIds),
    msgIds.length > 0
      ? supabase.from("messages").select("id, content, created_at").in("id", msgIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("users")
      .select("user_id, first_name, last_name")
      .in("user_id", Array.from(userIds)),
  ]);

  type ConvRow = { id: number; missionary_id: number; supporter_id: string };
  type MsgRow = { id: number; content: string; created_at: string };
  type UserRow = { first_name: string | null; last_name: string | null };

  const convMap = new Map<number, ConvRow>(
    (convData || []).map((c: ConvRow) => [c.id, c])
  );
  const msgMap = new Map<number, MsgRow>(
    (msgData || []).map((m: MsgRow) => [m.id, m])
  );
  const usersMap = new Map<string, UserRow>(
    (usersData || []).map((u: { user_id: string } & UserRow) => [
      u.user_id,
      { first_name: u.first_name, last_name: u.last_name },
    ])
  );

  const missionaryIds = [...new Set((convData || []).map((c: ConvRow) => c.missionary_id))];
  const supporterIds = [...new Set((convData || []).map((c: ConvRow) => c.supporter_id))];

  const { data: missionaryData } = await supabase
    .from("missionaries")
    .select("id, first_name, last_name")
    .in("id", missionaryIds);

  const { data: supporterUsers } = await supabase
    .from("users")
    .select("user_id, first_name, last_name")
    .in("user_id", supporterIds);

  const missionaryMap = new Map<number, UserRow>(
    (missionaryData || []).map((m: { id: number } & UserRow) => [
      m.id,
      { first_name: m.first_name, last_name: m.last_name },
    ])
  );
  (supporterUsers || []).forEach((u: { user_id: string } & UserRow) => {
    usersMap.set(u.user_id, { first_name: u.first_name, last_name: u.last_name });
  });

  const formatName = (first: string | null, last: string | null) =>
    [first, last].filter(Boolean).join(" ") || "Unknown";

  return (reports as Record<string, unknown>[]).map((r) => {
    const conv = convMap.get(r.conversation_id as number);
    const missionary = conv ? missionaryMap.get(conv.missionary_id) : undefined;
    const reporter = usersMap.get(r.reported_by as string);
    const supporter = conv ? usersMap.get(conv.supporter_id) : undefined;
    const msg = r.message_id ? msgMap.get(r.message_id as number) : null;

    return {
      id: r.id as number,
      conversation_id: r.conversation_id as number,
      message_id: r.message_id as number | null,
      reported_by: r.reported_by as string,
      report_type: r.report_type as "message" | "conversation",
      reason: r.reason as string | null,
      status: r.status as "pending" | "reviewed" | "resolved",
      created_at: r.created_at as string,
      reporter_name: formatName(reporter?.first_name ?? null, reporter?.last_name ?? null),
      missionary_name: formatName(missionary?.first_name ?? null, missionary?.last_name ?? null),
      supporter_name: formatName(supporter?.first_name ?? null, supporter?.last_name ?? null),
      message_content: msg?.content ?? null,
      message_created_at: msg?.created_at ?? null,
    };
  });
}
