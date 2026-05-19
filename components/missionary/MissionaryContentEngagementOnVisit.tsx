"use client";

import { useEffect, useRef } from "react";
import { completeMissionaryContentEngagementForPage } from "@/lib/notificationHelpers";

type MissionaryContentEngagementOnVisitProps = {
  pageId: number;
  enabled: boolean;
};

export function MissionaryContentEngagementOnVisit({
  pageId,
  enabled,
}: MissionaryContentEngagementOnVisitProps) {
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;
    void completeMissionaryContentEngagementForPage(pageId);
  }, [pageId, enabled]);

  return null;
}
