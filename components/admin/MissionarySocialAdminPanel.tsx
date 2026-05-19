export type MissionarySocialAdminDiagnostics = {
  connection: {
    facebook_status: string;
    instagram_status: string;
    facebook_page_name: string | null;
    instagram_username: string | null;
    last_facebook_verified_at: string | null;
    last_instagram_verified_at: string | null;
  } | null;
  attempts: Array<{
    platform: string;
    status: string;
    source_table: string;
    source_id: number;
    error_detail: string | null;
    updated_at: string;
  }>;
};

export function MissionarySocialAdminPanel({ data }: { data: MissionarySocialAdminDiagnostics }) {
  const c = data.connection;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Social cross-post (troubleshooting)</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Connection status and recent cross-post attempts. Tokens are never shown.
      </p>
      <dl className="mt-3 grid gap-2 text-xs text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Facebook</dt>
          <dd>{c?.facebook_status ?? "—"}</dd>
          {c?.facebook_page_name && <dd className="text-zinc-500">{c.facebook_page_name}</dd>}
          <dd className="text-zinc-400">
            Last verified: {c?.last_facebook_verified_at ? new Date(c.last_facebook_verified_at).toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Instagram</dt>
          <dd>{c?.instagram_status ?? "—"}</dd>
          {c?.instagram_username && <dd className="text-zinc-500">@{c.instagram_username}</dd>}
          <dd className="text-zinc-400">
            Last verified: {c?.last_instagram_verified_at ? new Date(c.last_instagram_verified_at).toLocaleString() : "—"}
          </dd>
        </div>
      </dl>
      {data.attempts.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Recent attempts</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-400">
            {data.attempts.map((a, i) => (
              <li key={`${a.platform}-${a.source_id}-${i}`} className="space-y-0.5">
                <div className="flex flex-wrap justify-between gap-1">
                  <span>
                    {a.platform} · {a.source_table} #{a.source_id}
                  </span>
                  <span
                    className={
                      a.status === "posted"
                        ? "text-green-600 dark:text-green-400"
                        : a.status === "failed"
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    {a.status}
                  </span>
                </div>
                {a.status === "failed" && a.error_detail && (
                  <p className="text-[11px] text-red-600/90 dark:text-red-400/90 line-clamp-2">{a.error_detail}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
