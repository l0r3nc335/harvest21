"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createPageWidget } from "@/lib/pageActions";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";
import toast from "react-hot-toast";

type TextUpdateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pageId: number;
  onSuccess: () => void;
};

export function TextUpdateModal({ isOpen, onClose, pageId, onSuccess }: TextUpdateModalProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [postToInstagram, setPostToInstagram] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setBody("");
      setPostToFacebook(false);
      setPostToInstagram(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const widgetTitle = title.trim() || "Update";
      const result = await createPageWidget(
        pageId,
        "text_update",
        widgetTitle,
        { body: body.trim() },
        {
          postToFacebook,
          postToInstagram,
        }
      );
      if (result.success) {
        onClose();
        onSuccess();
        toast.success("Update posted");
      } else {
        toast.error(result.message || "Failed to post");
      }
    } catch {
      toast.error("Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post a text update" size="md" variant="dark">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div>
          <label className="mb-1 block text-sm text-white">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            className="w-full rounded-lg border border-white/20 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
            placeholder="Short headline"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-white">Update</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            required
            rows={6}
            className="w-full rounded-lg border border-white/20 bg-[#0a0a0a] px-3 py-2 text-sm text-white"
            placeholder="Share an update with supporters"
          />
        </div>
        <SocialCrossPostCheckboxes
          pageId={pageId}
          contentMode="text-only"
          postToFacebook={postToFacebook}
          postToInstagram={postToInstagram}
          onChangeFacebook={setPostToFacebook}
          onChangeInstagram={setPostToInstagram}
          disabled={submitting}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !body.trim()} className="bg-[#E1B94D] text-black">
            {submitting ? "Posting…" : "Post"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
