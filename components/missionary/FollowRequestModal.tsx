"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const NOTE_MAX = 100;

interface FollowRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  missionaryName: string;
  isLoading?: boolean;
}

export function FollowRequestModal({
  isOpen,
  onClose,
  onConfirm,
  missionaryName,
  isLoading = false,
}: FollowRequestModalProps) {
  const [note, setNote] = useState("");

  const handleClose = () => {
    setNote("");
    onClose();
  };

  const handleSubmit = async () => {
    await onConfirm(note);
    setNote("");
  };

  const remaining = NOTE_MAX - note.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Follow ${missionaryName}`}
      size="sm"
      trapFocus
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your follow request will be sent to {missionaryName} for approval.
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="follow-note"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Add a note{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-500">
              (optional, to help them recognize you)
            </span>
          </label>
          <textarea
            id="follow-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder="e.g. Hi, we met at the mission conference last spring…"
            rows={3}
            maxLength={NOTE_MAX}
            className="w-full resize-none rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            aria-describedby="follow-note-counter"
          />
          <p
            id="follow-note-counter"
            className={`text-right text-xs ${
              remaining <= 10
                ? "text-red-500 dark:text-red-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {note.length} / {NOTE_MAX}
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-[#E1B94D] hover:bg-[#d4a639] text-black font-semibold"
          >
            {isLoading ? "Sending…" : "Send Request"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
