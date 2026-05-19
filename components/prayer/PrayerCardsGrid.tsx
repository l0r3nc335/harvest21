"use client";

import { useState, useEffect } from "react";
import { PrayerCard } from "./PrayerCard";
import type { Prayer } from "@/lib/prayerActions";

type PrayerCardsGridProps = {
  prayers: Prayer[];
  isOwner: boolean;
  onEdit: (prayer: Prayer) => void;
  onDelete: (prayerId: number) => void;
  onUpdate: (prayer: Prayer) => void;
  onView: (prayer: Prayer) => void;
  getLatestContent: (prayer: Prayer) => Promise<{ content: string; date: string; isUpdate: boolean }>;
};

export function PrayerCardsGrid({
  prayers,
  isOwner,
  onEdit,
  onDelete,
  onUpdate,
  onView,
  getLatestContent,
}: PrayerCardsGridProps) {
  const [prayerContents, setPrayerContents] = useState<Map<number, { content: string; date: string; isUpdate: boolean }>>(new Map());

  useEffect(() => {
    const loadContents = async () => {
      const contentsMap = new Map<number, { content: string; date: string; isUpdate: boolean }>();
      
      await Promise.all(
        prayers.map(async (prayer) => {
          const latest = await getLatestContent(prayer);
          contentsMap.set(prayer.id, latest);
        })
      );
      
      setPrayerContents(contentsMap);
    };

    if (prayers.length > 0) {
      loadContents();
    }
  }, [prayers, getLatestContent]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {prayers.map((prayer) => {
        const latestContent = prayerContents.get(prayer.id);
        return (
          <PrayerCard
            key={prayer.id}
            prayer={prayer}
            isOwner={isOwner}
            onEdit={() => onEdit(prayer)}
            onDelete={() => onDelete(prayer.id)}
            onUpdate={() => onUpdate(prayer)}
            onView={() => onView(prayer)}
            displayContent={latestContent?.content}
            displayDate={latestContent?.date}
          />
        );
      })}
    </div>
  );
}

