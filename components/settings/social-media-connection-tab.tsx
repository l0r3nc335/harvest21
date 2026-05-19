"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
  getSocialConnectionSummary,
  getRecentSocialCrossPosts,
  type SocialConnectionSummary,
} from "@/app/settings/social-media-actions";
import toast from "react-hot-toast";
import {
  writeCachedEligibility,
  notifySocialEligibilityChanged,
} from "@/lib/social-eligibility-cache";
import {
  SocialMediaPlatformCardSkeleton,
  SocialMediaRecentCrossPostsSkeleton,
} from "@/components/settings/settings-tab-skeletons";

const IG_HELP = "https://www.facebook.com/business/help/connect-instagram-to-page";

const META_OAUTH_MESSAGE_SOURCE = "harvest21-meta-oauth";
const META_OAUTH_POPUP_FEATURES =
  "popup=yes,width=520,height=720,left=80,top=80,resizable=yes,scrollbars=yes";

type PendingPage = { id: string; name: string; hasInstagram: boolean; instagramUsername: string | null };

type SocialMediaConnectionTabProps = {
  missionaryPageId?: number | null;
};

export function SocialMediaConnectionTab({ missionaryPageId = null }: SocialMediaConnectionTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<SocialConnectionSummary>(null);
  const [recent, setRecent] = useState<
    Array<{
      platform: string;
      status: string;
      source_table: string;
      source_id: number;
      error_detail: string | null;
      updated_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [igDialogOpen, setIgDialogOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickIntent, setPickIntent] = useState<"facebook" | "instagram" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [completing, setCompleting] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState<"facebook" | "instagram" | null>(null);
  const oauthPopupPollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (oauthPopupPollRef.current !== null) {
        window.clearInterval(oauthPopupPollRef.current);
        oauthPopupPollRef.current = null;
      }
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([getSocialConnectionSummary(), getRecentSocialCrossPosts(8)]);
      setSummary(s);
      setRecent(r);
      if (missionaryPageId) {
        writeCachedEligibility(
          missionaryPageId,
          s?.facebookStatus === "connected",
          s?.instagramStatus === "connected"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [missionaryPageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const origin = window.location.origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || !e.data || e.data.source !== META_OAUTH_MESSAGE_SOURCE) {
        return;
      }
      const d = e.data as {
        source: string;
        status: string;
        message?: string;
        platform?: string;
        intent?: string;
        pendingId?: string;
      };
      if (d.status === "error" && d.message) {
        toast.error(d.message);
        return;
      }
      if (d.status === "success" && (d.platform === "facebook" || d.platform === "instagram")) {
        toast.success(d.platform === "instagram" ? "Instagram connected" : "Facebook connected");
        void load().then(() => notifySocialEligibilityChanged());
        return;
      }
      if (
        d.status === "pick" &&
        (d.intent === "facebook" || d.intent === "instagram") &&
        d.pendingId
      ) {
        setPickIntent(d.intent);
        setPendingId(d.pendingId);
        void (async () => {
          const res = await fetch(`/api/auth/meta/pending-pages?id=${encodeURIComponent(d.pendingId!)}`);
          const data = await res.json();
          if (data.success && data.pages) {
            setPendingPages(data.pages);
            setPickOpen(true);
          } else {
            toast.error(data.error || "Could not load pages");
          }
        })();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load]);

  useEffect(() => {
    const err = searchParams.get("meta_error");
    const done = searchParams.get("meta_done");
    const pick = searchParams.get("meta_pick");
    const pend = searchParams.get("meta_pending");
    if (err) {
      toast.error(decodeURIComponent(err));
      router.replace("/settings?tab=social-media-connection");
    }
    if (done) {
      toast.success(done === "instagram" ? "Instagram connected" : "Facebook connected");
      router.replace("/settings?tab=social-media-connection");
      void load().then(() => notifySocialEligibilityChanged());
    }
    if (pick && pend && (pick === "facebook" || pick === "instagram")) {
      setPickIntent(pick);
      setPendingId(pend);
      void (async () => {
        const res = await fetch(`/api/auth/meta/pending-pages?id=${encodeURIComponent(pend)}`);
        const data = await res.json();
        if (data.success && data.pages) {
          setPendingPages(data.pages);
          setPickOpen(true);
        } else {
          toast.error(data.error || "Could not load pages");
        }
      })();
    }
  }, [searchParams, router, load]);

  const openMetaOAuthPopup = (intent: "facebook" | "instagram") => {
    if (oauthPopupPollRef.current !== null) {
      window.clearInterval(oauthPopupPollRef.current);
      oauthPopupPollRef.current = null;
    }
    const url = new URL(
      `/api/auth/meta/start?intent=${intent}&popup=1`,
      window.location.origin
    ).href;
    const name = `h21_meta_oauth_${Date.now()}`;
    const w = window.open("about:blank", name, META_OAUTH_POPUP_FEATURES);
    if (!w) {
      window.location.assign(`/api/auth/meta/start?intent=${intent}`);
      return;
    }
    try {
      w.location.assign(url);
    } catch {
      w.close();
      window.location.assign(`/api/auth/meta/start?intent=${intent}`);
      return;
    }
    w.focus();
    const started = Date.now();
    oauthPopupPollRef.current = window.setInterval(() => {
      const closed = w.closed;
      const expired = Date.now() - started > 15 * 60 * 1000;
      if (!closed && !expired) {
        return;
      }
      if (oauthPopupPollRef.current !== null) {
        window.clearInterval(oauthPopupPollRef.current);
        oauthPopupPollRef.current = null;
      }
      if (closed) {
        void load().then(() => notifySocialEligibilityChanged());
      }
    }, 400);
  };

  const startOAuth = (intent: "facebook" | "instagram") => {
    if (intent === "instagram") {
      setIgDialogOpen(true);
      return;
    }
    openMetaOAuthPopup("facebook");
  };

  const continueInstagram = () => {
    setIgDialogOpen(false);
    openMetaOAuthPopup("instagram");
  };

  const performDisconnect = async (platform: "facebook" | "instagram") => {
    const res = await fetch("/api/auth/meta/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    if (!res.ok) {
      toast.error("Could not disconnect. Please try again.");
      throw new Error("disconnect failed");
    }
    toast.success("Disconnected");
    try {
      await load();
    } catch {
      /* still refresh eligibility */
    }
    notifySocialEligibilityChanged();
  };

  const socialActionsBusy = loading || disconnectConfirm !== null;

  const completePick = async (pageId: string) => {
    if (!pendingId) {
      return;
    }
    setCompleting(true);
    try {
      const res = await fetch("/api/auth/meta/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId, pageId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Connected");
        setPickOpen(false);
        setPendingId(null);
        setPickIntent(null);
        router.replace("/settings?tab=social-media-connection");
        void load().then(() => notifySocialEligibilityChanged());
      } else {
        toast.error(data.message || "Failed");
      }
    } finally {
      setCompleting(false);
    }
  };

  const fbLabel = (s: SocialConnectionSummary) => {
    if (!s) {
      return "Not Connected";
    }
    if (s.facebookStatus === "reconnect_required") {
      return "Reconnect Required";
    }
    if (s.facebookStatus === "connected") {
      return "Connected";
    }
    return "Not Connected";
  };

  const igLabel = (s: SocialConnectionSummary) => {
    if (!s) {
      return "Not Connected";
    }
    if (s.instagramStatus === "reconnect_required") {
      return "Reconnect Required";
    }
    if (s.instagramStatus === "connected") {
      return "Connected";
    }
    return "Not Connected";
  };

  return (
    <div className="max-w-2xl space-y-10 text-white">
      <div>
        <h2 className="text-xl font-semibold">Social Media Connection</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Connect your Facebook and Instagram accounts so Harvest 21 can share your updates when you publish
          them.
        </p>
      </div>

      <section className="rounded-lg border border-white/10 bg-zinc-900/50 p-5">
        <h3 className="text-lg font-medium">Facebook</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Share updates from Harvest 21 directly to your connected Facebook Page.
        </p>
        {loading ? (
          <SocialMediaPlatformCardSkeleton />
        ) : (
          <>
            <p className="mt-3 text-sm">
              Status: <span className="text-[#E1B94D]">{fbLabel(summary)}</span>
            </p>
            {summary?.facebookStatus === "connected" && summary.facebookPageName && (
              <p className="mt-1 text-sm text-zinc-300">
                Connected to: <span className="text-white">{summary.facebookPageName}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {(summary?.facebookStatus === "not_connected" || !summary) && (
                <Button
                  className="bg-[#E1B94D] text-black"
                  disabled={socialActionsBusy}
                  onClick={() => startOAuth("facebook")}
                >
                  Connect Facebook
                </Button>
              )}
              {summary?.facebookStatus === "connected" && (
                <Button variant="secondary" onClick={() => setDisconnectConfirm("facebook")}>
                  Disconnect
                </Button>
              )}
              {summary?.facebookStatus === "reconnect_required" && (
                <>
                  <Button
                    className="bg-[#E1B94D] text-black"
                    disabled={socialActionsBusy}
                    onClick={() => startOAuth("facebook")}
                  >
                    Reconnect Facebook
                  </Button>
                  <Button variant="secondary" onClick={() => setDisconnectConfirm("facebook")}>
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-white/10 bg-zinc-900/50 p-5">
        <h3 className="text-lg font-medium">Instagram</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Share photos, videos, and update letter previews from Harvest 21 directly to your connected Instagram
          account.
        </p>
        <p className="mt-2 text-sm text-amber-200/90">
          Instagram sharing requires a Professional (Creator or Business) account.
        </p>
        <a
          href={IG_HELP}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-[#E1B94D] underline hover:no-underline"
        >
          How to connect Instagram
        </a>
        {loading ? (
          <SocialMediaPlatformCardSkeleton />
        ) : (
          <>
            <p className="mt-3 text-sm">
              Status: <span className="text-[#E1B94D]">{igLabel(summary)}</span>
            </p>
            {summary?.instagramStatus === "connected" && summary.instagramUsername && (
              <p className="mt-1 text-sm text-zinc-300">
                Connected to:{" "}
                <span className="text-white">@{summary.instagramUsername}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {(summary?.instagramStatus === "not_connected" || !summary) && (
                <Button
                  className="bg-[#E1B94D] text-black"
                  disabled={socialActionsBusy}
                  onClick={() => startOAuth("instagram")}
                >
                  Connect Instagram
                </Button>
              )}
              {summary?.instagramStatus === "connected" && (
                <Button variant="secondary" onClick={() => setDisconnectConfirm("instagram")}>
                  Disconnect
                </Button>
              )}
              {summary?.instagramStatus === "reconnect_required" && (
                <>
                  <Button
                    className="bg-[#E1B94D] text-black"
                    disabled={socialActionsBusy}
                    onClick={() => startOAuth("instagram")}
                  >
                    Reconnect Instagram
                  </Button>
                  <Button variant="secondary" onClick={() => setDisconnectConfirm("instagram")}>
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {loading ? (
        <section>
          <h3 className="text-sm font-medium text-zinc-300">Recent cross-posts</h3>
          <SocialMediaRecentCrossPostsSkeleton />
        </section>
      ) : (
        recent.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-zinc-300">Recent cross-posts</h3>
            <ul className="mt-2 space-y-2 text-xs text-zinc-400">
              {recent.map((r, i) => (
                <li key={`${r.platform}-${r.source_id}-${i}`} className="flex justify-between gap-2 border-b border-white/5 pb-2">
                  <span>
                    {r.platform} · {r.source_table} #{r.source_id}
                  </span>
                  <span className={r.status === "posted" ? "text-green-400" : r.status === "failed" ? "text-red-400" : "text-amber-400"}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      <ConfirmationModal
        isOpen={disconnectConfirm !== null}
        onClose={() => setDisconnectConfirm(null)}
        onConfirm={async () => {
          if (disconnectConfirm) {
            await performDisconnect(disconnectConfirm);
          }
        }}
        elevation="high"
        variant="danger"
        title={
          disconnectConfirm === "instagram"
            ? "Disconnect Instagram?"
            : "Disconnect Facebook?"
        }
        message={
          disconnectConfirm === "instagram"
            ? "Harvest 21 will stop posting to your connected Instagram account. You can connect again anytime from this screen."
            : "Harvest 21 will stop posting to your connected Facebook Page. You can connect again anytime from this screen."
        }
        confirmText="Disconnect"
        cancelText="Cancel"
        loadingText="Disconnecting…"
      />

      <Modal isOpen={igDialogOpen} onClose={() => setIgDialogOpen(false)} title="Connect Instagram" variant="dark">
        <div className="space-y-4 p-4 text-sm text-zinc-300">
          <p>
            To share updates from Harvest 21 to Instagram, your Instagram account must be a Professional (Creator
            or Business) account.
          </p>
          <p>Personal Instagram accounts cannot be used for cross-posting.</p>
          <p>
            If your account is currently personal, you can switch it to a Professional account in your Instagram
            settings.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button className="bg-[#E1B94D] text-black" onClick={continueInstagram}>
              Continue
            </Button>
            <a
              href={IG_HELP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              View Instructions
            </a>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={pickOpen}
        onClose={() => {
          setPickOpen(false);
          router.replace("/settings?tab=social-media-connection");
        }}
        title={pickIntent === "instagram" ? "Choose a Page with Instagram" : "Choose Facebook Page"}
        variant="dark"
      >
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
          {pendingPages.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={completing}
              onClick={() => completePick(p.id)}
              className="w-full rounded-lg border border-white/15 bg-zinc-900 px-4 py-3 text-left text-sm text-white hover:border-[#E1B94D]/50"
            >
              <span className="font-medium">{p.name}</span>
              {p.hasInstagram && (
                <span className="ml-2 text-xs text-zinc-400">
                  IG{p.instagramUsername ? ` @${p.instagramUsername}` : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
