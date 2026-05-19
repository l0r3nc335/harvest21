"use client";

import { useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { RichEditor } from "./RichEditor";
import { RichContent } from "./RichContent";
import {
  uploadMedia,
  syncEditorMedia,
  type SyncEditorMediaResult,
} from "@/lib/editorMediaHelpers";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

export function RichEditorDemoClient() {
  const [content, setContent] = useState<JSONContent | null>(null);
  const [savedContent, setSavedContent] = useState<JSONContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content) {
      setSavedContent(null);
      return;
    }

    setIsSaving(true);

    try {
      let synced: SyncEditorMediaResult["syncedJSON"] = content;

      const hasLocalMedia = JSON.stringify(content).includes("blob:");

      if (hasLocalMedia) {
        const result = await syncEditorMedia(content, savedContent);
        synced = result.syncedJSON;
      }

      setSavedContent(synced);
      setContent(synced);
      toast.success("Content updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update content");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">RichEditor (editable)</h2>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Updating…" : "Update Content"}
          </Button>
        </div>

        <RichEditor content={content} onChange={setContent} />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">RichContent (public view)</h2>
        <p className="text-xs text-muted-foreground">
          This read-only view uses the same Tiptap JSON and `tiptap.css` styling.
        </p>
        <div className="border rounded-lg p-4">
          <RichContent content={savedContent ?? content} />
        </div>
      </div>
    </div>
  );
}


