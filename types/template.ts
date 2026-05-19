export type FieldType = "text" | "richtext" | "list" | "video";

export type TemplateFieldConfig = {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  editable: boolean;
  defaultValue?: string | string[];
};

export type TemplateSectionType =
  | "header"
  | "static-title"
  | "richtext"
  | "two-column";

export type TemplateSectionConfig = {
  id: string;
  type: TemplateSectionType;
  fields: TemplateFieldConfig[];
  columns?: {
    left: TemplateFieldConfig[];
    right: TemplateFieldConfig[];
  };
};

export type TemplateConfig = {
  id: string;
  name: string;
  description: string;
  version: string;
  sections: TemplateSectionConfig[];
};

export type TemplateFieldValue = string | string[];

export type TemplateContentState = {
  templateId: string;
  fields: Record<string, TemplateFieldValue>;
  videoUrl?: string | null;
  pendingVideoFile?: File | null;
};

export type TemplateRegistry = {
  [templateId: string]: TemplateConfig;
};

