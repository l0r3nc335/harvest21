"use client";

import { forwardRef } from "react";

export type RichTextSectionHandle = {
  getHTML: () => string;
  processPendingUploads: () => Promise<void>;
};

type RichTextSectionProps = {
  fieldId: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (fieldId: string, value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onUploadVideo?: (file: File) => Promise<string>;
  onDeleteFile?: (url: string) => Promise<void>;
  readOnly?: boolean;
  isMissing?: boolean;
};

export const RichTextSection = forwardRef<RichTextSectionHandle, RichTextSectionProps>(
  function RichTextSection(
    {
      fieldId,
      label,
      placeholder,
      value,
      onChange,
      readOnly = false,
      isMissing = false,
    },
    ref
  ) {
    return (
      <div className="space-y-2">
        <textarea
          value={value}
          onChange={(e) => onChange(fieldId, e.target.value)}
          placeholder={placeholder}
          disabled={readOnly}
          rows={6}
          className={`block w-full rounded-md border px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 resize-y min-h-[100px] ${
            isMissing
              ? "border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20 dark:bg-red-950/20 dark:border-red-500"
              : "border-zinc-300 bg-white focus:border-zinc-400 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
          }`}
        />
      </div>
    );
  }
);

