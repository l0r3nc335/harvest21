"use client";

import { getAllTemplates } from "@/lib/templates/registry";
import type { TemplateConfig } from "@/types/template";

type TemplateSelectorProps = {
  selectedTemplateId: string;
  onSelect: (template: TemplateConfig) => void;
  disabled?: boolean;
};

export function TemplateSelector({
  selectedTemplateId,
  onSelect,
  disabled = false,
}: TemplateSelectorProps) {
  const templates = getAllTemplates();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-700">
        Page Template
      </label>
      <select
        value={selectedTemplateId}
        onChange={(e) => {
          const template = templates.find((t) => t.id === e.target.value);
          if (template) onSelect(template);
        }}
        disabled={disabled}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      {templates.find((t) => t.id === selectedTemplateId)?.description && (
        <p className="text-xs text-zinc-500">
          {templates.find((t) => t.id === selectedTemplateId)?.description}
        </p>
      )}
    </div>
  );
}

