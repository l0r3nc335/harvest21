const MESSAGE_SOURCE = "harvest21-meta-oauth" as const;

export type MetaOAuthPopupPayload =
  | { source: typeof MESSAGE_SOURCE; status: "error"; message: string }
  | { source: typeof MESSAGE_SOURCE; status: "success"; platform: "facebook" | "instagram" }
  | {
      source: typeof MESSAGE_SOURCE;
      status: "pick";
      intent: "facebook" | "instagram";
      pendingId: string;
    };

export function metaOAuthPopupResponse(payload: MetaOAuthPopupPayload): Response {
  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Harvest 21</title></head><body>
<script>
(function(){
  var p=${safePayload};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(p, window.location.origin);
    }
  } catch (e) {}
  setTimeout(function(){ window.close(); }, 100);
})();
</script>
<p style="font-family:system-ui,sans-serif;text-align:center;margin-top:2rem;color:#444">Closing…</p>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
