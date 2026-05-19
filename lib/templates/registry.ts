import type { TemplateConfig, TemplateRegistry } from "@/types/template";
import { aboutYouTemplate } from "./about-you-template";
import { simpleTemplate } from "./simple-template";

export const templateRegistry: TemplateRegistry = {
  [aboutYouTemplate.id]: aboutYouTemplate,
  [simpleTemplate.id]: simpleTemplate,
};

export function getTemplate(templateId: string): TemplateConfig | null {
  return templateRegistry[templateId] || null;
}

export function getAllTemplates(): TemplateConfig[] {
  return Object.values(templateRegistry);
}

export function getDefaultTemplate(): TemplateConfig {
  return aboutYouTemplate;
}

