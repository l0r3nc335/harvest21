import type { TemplateConfig } from "@/types/template";

export const aboutYouTemplate: TemplateConfig = {
  id: "about-you",
  name: "Default Template",
  description: "A comprehensive template with video header and mission sections",
  version: "1.0.0",
  sections: [
    {
      id: "header",
      type: "header",
      fields: [
        {
          id: "headerVideo",
          type: "video",
          label: "Background Video",
          editable: true,
        },
        {
          id: "headerTitle",
          type: "text",
          label: "Title",
          editable: false,
          defaultValue: "Personal Bio",
        },
        {
          id: "headerSubtitle",
          type: "richtext",
          label: "Subtitle / Description",
          placeholder: "Enter your description",
          editable: true,
          defaultValue: "",
        },
      ],
    },
    {
      id: "missionTitle",
      type: "static-title",
      fields: [
        {
          id: "missionTitleText",
          type: "text",
          label: "Section Title",
          editable: false,
          defaultValue: "The Mission",
        },
      ],
    },
    {
      id: "missionDescription",
      type: "richtext",
      fields: [
        {
          id: "missionContent",
          type: "richtext",
          label: "Mission Description",
          placeholder: "Describe your mission...",
          editable: true,
          defaultValue: "",
        },
      ],
    },
    {
      id: "goalsAndChallenges",
      type: "two-column",
      fields: [],
      columns: {
        left: [
          {
            id: "goalsTitle",
            type: "text",
            label: "Column Title",
            editable: false,
            defaultValue: "Key Goals",
          },
          {
            id: "goalsList",
            type: "list",
            label: "Goals",
            placeholder: "Add a goal",
            editable: true,
            defaultValue: [],
          },
        ],
        right: [
          {
            id: "challengesTitle",
            type: "text",
            label: "Column Title",
            editable: false,
            defaultValue: "Challenges",
          },
          {
            id: "challengesList",
            type: "list",
            label: "Challenges",
            placeholder: "Add a challenge",
            editable: true,
            defaultValue: [],
          },
        ],
      },
    },
    {
      id: "heartTitle",
      type: "static-title",
      fields: [
        {
          id: "heartTitleText",
          type: "text",
          label: "Section Title",
          editable: false,
          defaultValue: "The Heart Behind the Mission",
        },
      ],
    },
    {
      id: "heartDescription",
      type: "richtext",
      fields: [
        {
          id: "heartContent",
          type: "richtext",
          label: "Heart Description",
          placeholder: "Share your heart...",
          editable: true,
          defaultValue: "",
        },
      ],
    },
    {
      id: "joinTitle",
      type: "static-title",
      fields: [
        {
          id: "joinTitleText",
          type: "text",
          label: "Section Title",
          editable: false,
          defaultValue: "Join in the Journey",
        },
      ],
    },
    {
      id: "joinDescription",
      type: "richtext",
      fields: [
        {
          id: "joinContent",
          type: "richtext",
          label: "Join Description",
          placeholder: "Invite others to join...",
          editable: true,
          defaultValue: "",
        },
      ],
    },
  ],
};

export function getAboutYouDefaultContent(): Record<string, string | string[]> {
  const content: Record<string, string | string[]> = {};

  aboutYouTemplate.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        content[field.id] = field.defaultValue;
      }
    });

    if (section.columns) {
      section.columns.left.forEach((field) => {
        if (field.defaultValue !== undefined) {
          content[field.id] = field.defaultValue;
        }
      });
      section.columns.right.forEach((field) => {
        if (field.defaultValue !== undefined) {
          content[field.id] = field.defaultValue;
        }
      });
    }
  });

  return content;
}

