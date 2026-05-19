"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { getSocialCrossPostEligibility } from "@/app/settings/social-media-actions";
import {
  readCachedEligibility,
  writeCachedEligibility,
  SOCIAL_ELIGIBILITY_CHANGED,
} from "@/lib/social-eligibility-cache";

type SocialCrossPostCheckboxesProps = {
  pageId: number;
  contentMode: "text-only" | "media";
  postToFacebook: boolean;
  postToInstagram: boolean;
  onChangeFacebook: (v: boolean) => void;
  onChangeInstagram: (v: boolean) => void;
  disabled?: boolean;
};

export function SocialCrossPostCheckboxes({
  pageId,
  contentMode,
  postToFacebook,
  postToInstagram,
  onChangeFacebook,
  onChangeInstagram,
  disabled,
}: SocialCrossPostCheckboxesProps) {
  const [fb, setFb] = useState(false);
  const [ig, setIg] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const c = readCachedEligibility(pageId);
    if (c) {
      setFb(c.fb);
      setIg(c.ig);
      setReady(true);
    } else {
      setReady(false);
    }
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const e = await getSocialCrossPostEligibility(pageId);
        if (!cancelled) {
          setFb(e.canPostFacebook);
          setIg(e.canPostInstagram);
          writeCachedEligibility(pageId, e.canPostFacebook, e.canPostInstagram);
        }
      } catch {
        if (!cancelled) {
          setFb(false);
          setIg(false);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };
    void run();
    const onRefresh = () => {
      void run();
    };
    window.addEventListener(SOCIAL_ELIGIBILITY_CHANGED, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(SOCIAL_ELIGIBILITY_CHANGED, onRefresh);
    };
  }, [pageId]);

  if (!ready) {
    return (
      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-zinc-400">Checking social connections…</p>
      </div>
    );
  }

  if (!fb && !ig) {
    return (
      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-xs font-medium text-zinc-300">Cross-post to Facebook or Instagram</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Connect or reconnect your accounts under{" "}
          <Link
            href="/settings?tab=social-media-connection"
            className="text-[#E1B94D] underline underline-offset-2 hover:no-underline"
          >
            Settings → Social Media Connection
          </Link>
          . Then reopen this dialog to see Post to Facebook and Post to Instagram here.
        </p>
      </div>
    );
  }

  const showIg = contentMode === "media" && ig;

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-medium text-zinc-300">Also post to social</p>
      {fb && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={postToFacebook}
            disabled={disabled}
            onChange={(e) => onChangeFacebook(e.target.checked)}
            className="h-4 w-4 rounded border-white/30"
          />
          Post to Facebook
        </label>
      )}
      {showIg && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={postToInstagram}
            disabled={disabled}
            onChange={(e) => onChangeInstagram(e.target.checked)}
            className="h-4 w-4 rounded border-white/30"
          />
          Post to Instagram
        </label>
      )}
    </div>
  );
}
