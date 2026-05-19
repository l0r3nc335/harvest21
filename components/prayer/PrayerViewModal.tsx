"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  getPrayerUpdates,
  type PrayerUpdate,
} from "@/lib/prayerActions";
import type { Prayer } from "@/lib/prayerActions";

type PrayerViewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  prayer: Prayer;
  onPrayerUpdate?: () => void;
};

export function PrayerViewModal({
  isOpen,
  onClose,
  prayer,
  onPrayerUpdate,
}: PrayerViewModalProps) {
  const [updates, setUpdates] = useState<PrayerUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [prayerData, setPrayerData] = useState<Prayer>(prayer);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen || !prayer) return;
      setLoading(true);
      const result = await getPrayerUpdates(prayer.id);
      if (!cancelled && result.success && result.data) {
        setUpdates(result.data);
        setPrayerData(prayer);
      }
      if (!cancelled) {
        setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, prayer]);

  const sortedUpdates = useMemo(() => {
    return [...updates].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [updates]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatUpdateDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prayer Request"
      size="lg"
      variant="dark"
    >
      <div className="flex flex-col max-h-[calc(90vh-120px)] overflow-y-auto scrollbar-yellow p-4 space-y-6">
        <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4 sm:p-6">
          <div className="mb-4">
            <span className="text-sm text-[#a0a0a0]">
              {formatDate(prayerData.created_at)}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-base leading-relaxed text-white whitespace-pre-wrap wrap-break-word">
              {prayerData.body}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Updates {updates.length > 0 && `(${updates.length})`}
          </h3>

          {loading ? (
            <div className="text-center text-[#a0a0a0] py-8">
              Loading updates...
            </div>
          ) : sortedUpdates.length === 0 ? (
            <div className="text-center text-[#a0a0a0] py-8">
              No updates yet.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedUpdates.map((update) => (
                <div
                  key={update.id}
                  className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-[#a0a0a0]">
                      {formatUpdateDate(update.created_at)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white whitespace-pre-wrap wrap-break-word">
                    {update.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

