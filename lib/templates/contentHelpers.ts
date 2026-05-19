import type { TemplateContentState, TemplateFieldValue } from "@/types/template";
import { getTemplate, getDefaultTemplate } from "./registry";

export type SerializedTemplateContent = {
  templateId: string;
  fields: Record<string, TemplateFieldValue>;
  videoUrl: string | null;
};

export function serializeTemplateContent(
  state: TemplateContentState
): string {
  const serialized: SerializedTemplateContent = {
    templateId: state.templateId,
    fields: state.fields,
    videoUrl: state.videoUrl || null,
  };
  return JSON.stringify(serialized);
}

export function deserializeTemplateContent(
  json: string | null | undefined
): TemplateContentState | null {
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as SerializedTemplateContent;
    return {
      templateId: parsed.templateId,
      fields: parsed.fields || {},
      videoUrl: parsed.videoUrl,
      pendingVideoFile: null,
    };
  } catch {
    return null;
  }
}

export function getDefaultContentState(templateId?: string): TemplateContentState {
  const template = templateId
    ? getTemplate(templateId) || getDefaultTemplate()
    : getDefaultTemplate();

  const fields: Record<string, TemplateFieldValue> = {};

  template.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        fields[field.id] = field.defaultValue;
      }
    });

    if (section.columns) {
      section.columns.left.forEach((field) => {
        if (field.defaultValue !== undefined) {
          fields[field.id] = field.defaultValue;
        }
      });
      section.columns.right.forEach((field) => {
        if (field.defaultValue !== undefined) {
          fields[field.id] = field.defaultValue;
        }
      });
    }
  });

  return {
    templateId: template.id,
    fields,
    videoUrl: null,
    pendingVideoFile: null,
  };
}

export function isFieldEditable(templateId: string, fieldId: string): boolean {
  const template = getTemplate(templateId);
  if (!template) return false;

  for (const section of template.sections) {
    const field = section.fields.find((f) => f.id === fieldId);
    if (field) return field.editable;

    if (section.columns) {
      const leftField = section.columns.left.find((f) => f.id === fieldId);
      if (leftField) return leftField.editable;

      const rightField = section.columns.right.find((f) => f.id === fieldId);
      if (rightField) return rightField.editable;
    }
  }

  return false;
}

export function getFieldConfig(templateId: string, fieldId: string) {
  const template = getTemplate(templateId);
  if (!template) return null;

  for (const section of template.sections) {
    const field = section.fields.find((f) => f.id === fieldId);
    if (field) return field;

    if (section.columns) {
      const leftField = section.columns.left.find((f) => f.id === fieldId);
      if (leftField) return leftField;

      const rightField = section.columns.right.find((f) => f.id === fieldId);
      if (rightField) return rightField;
    }
  }

  return null;
}

