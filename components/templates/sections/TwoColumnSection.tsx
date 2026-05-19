"use client";

import type { TemplateFieldConfig, TemplateFieldValue } from "@/types/template";
import { ListEditor } from "./ListEditor";

type TwoColumnSectionProps = {
  leftFields: TemplateFieldConfig[];
  rightFields: TemplateFieldConfig[];
  content: Record<string, TemplateFieldValue>;
  onChange: (fieldId: string, value: TemplateFieldValue) => void;
  readOnly?: boolean;
  missingFields?: Set<string>;
};

export function TwoColumnSection({
  leftFields,
  rightFields,
  content,
  onChange,
  readOnly = false,
  missingFields = new Set(),
}: TwoColumnSectionProps) {
  const renderColumn = (fields: TemplateFieldConfig[], side: "left" | "right") => {
    const titleField = fields.find((f) => f.type === "text" && !f.editable);
    const listField = fields.find((f) => f.type === "list");

    return (
      <div className="flex-1 space-y-4">
        {titleField && (
          <h2 className="font-semibold text-zinc-800">
            {(content[titleField.id] as string) || titleField.defaultValue}
          </h2>
        )}
        {listField && (
          <ListEditor
            fieldId={listField.id}
            label=""
            placeholder={listField.placeholder}
            items={(content[listField.id] as string[]) || []}
            onChange={onChange}
            readOnly={readOnly || !listField.editable}
            isMissing={missingFields.has(listField.id)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderColumn(leftFields, "left")}
        {renderColumn(rightFields, "right")}
      </div>
    </div>
  );
}

