"use client";

import { useState, useImperativeHandle, forwardRef, useEffect } from "react";
import type {
  TemplateConfig,
  TemplateFieldValue,
  TemplateContentState,
  TemplateSectionConfig,
} from "@/types/template";
import { TemplateSelector } from "./TemplateSelector";
import { VideoHeaderSection } from "./sections/VideoHeaderSection";
import { StaticTitle } from "./sections/StaticTitle";
import { RichTextSection } from "./sections/RichTextSection";
import { TwoColumnSection } from "./sections/TwoColumnSection";
import { getTemplate, getDefaultTemplate } from "@/lib/templates/registry";
import { deleteFileFromStorage } from "@/lib/pageActions";

export type TemplateEditorHandle = {
  getContentState: () => TemplateContentState;
  processUploads: (
    organizationType: string,
    organizationId: string | number,
    onProgress?: (progress: number) => void
  ) => Promise<{
    videoUrl: string | null;
    deletedVideoUrl: string | null;
  }>;
  hasPendingVideo: () => boolean;
};

type TemplateEditorProps = {
  initialTemplateId?: string;
  initialContent?: Record<string, TemplateFieldValue>;
  initialVideoUrl?: string | null;
  missingFields?: Set<string>;
  readOnly?: boolean;
  onChange?: (content: Record<string, TemplateFieldValue>, videoUrl: string | null, pendingVideoFile: File | null) => void;
};

export const TemplateEditor = forwardRef<TemplateEditorHandle, TemplateEditorProps>(
  function TemplateEditor(
    {
      initialTemplateId,
      initialContent = {},
      initialVideoUrl = null,
      missingFields = new Set(),
      readOnly = false,
      onChange,
    },
    ref
  ) {
    // Always edit using the default "About You" template structure.
    // The selected template ID controls how the page is rendered,
    // but does not change which fields are editable here.
    const [template] = useState<TemplateConfig>(getDefaultTemplate());
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
      initialTemplateId || getDefaultTemplate().id
    );
    const [content, setContent] = useState<Record<string, TemplateFieldValue>>(
      initialContent
    );
    const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl);
    const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
    const [videoToDelete, setVideoToDelete] = useState<string | null>(null);

    // Notify parent of changes
    useEffect(() => {
      onChange?.(content, videoUrl, pendingVideoFile);
    }, [content, videoUrl, pendingVideoFile, onChange]);

    const handleFieldChange = (fieldId: string, value: TemplateFieldValue) => {
      setContent((prev) => ({ ...prev, [fieldId]: value }));
    };

    const handleVideoSelect = (file: File | null) => {
      if (file === null) {
        if (videoUrl) {
          setVideoToDelete(videoUrl);
        }
        setVideoUrl(null);
        setPendingVideoFile(null);
      } else {
        if (videoUrl) {
          setVideoToDelete(videoUrl);
          setVideoUrl(null);
        }
        setPendingVideoFile(file);
      }
    };

    useImperativeHandle(ref, () => ({
      getContentState: () => {
        const headerSection = template.sections.find((s) => s.type === "header");
        const titleField = headerSection?.fields.find((f) => f.id === "headerTitle");
        const fieldsWithStaticTitle = {
          ...content,
          headerTitle: titleField?.defaultValue || "Personal Bio",
        };
        return {
          templateId: selectedTemplateId,
          fields: fieldsWithStaticTitle,
          videoUrl,
          pendingVideoFile,
        };
      },
      hasPendingVideo: () => !!pendingVideoFile,
      processUploads: async (
        organizationType: string,
        organizationId: string | number,
        onProgress?: (progress: number) => void
      ) => {
        let newVideoUrl: string | null = videoUrl;
        const deletedVideoUrl = videoToDelete;

        if (pendingVideoFile) {
          if (videoToDelete) {
            await deleteFileFromStorage(videoToDelete);
          }

          onProgress?.(5);

          const signedRes = await fetch("/api/storage/signed-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationType,
              organizationId: Number(organizationId),
              fileName: pendingVideoFile.name,
            }),
          });

          if (!signedRes.ok) {
            throw new Error("Failed to get upload URL");
          }

          const { signedUrl, publicUrl } = await signedRes.json();

          if (!signedUrl || !publicUrl) {
            throw new Error("Upload URL response missing data");
          }

          const result = await new Promise<{ success: boolean; publicUrl?: string; error?: string }>((resolve) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener("progress", (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                onProgress?.(percentComplete);
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ success: true, publicUrl });
              } else {
                resolve({ success: false, error: `Upload failed with status ${xhr.status}` });
              }
            });

            xhr.addEventListener("error", () => {
              resolve({ success: false, error: "Network error during upload" });
            });

            xhr.open("PUT", signedUrl);
            xhr.setRequestHeader("Content-Type", pendingVideoFile.type || "application/octet-stream");
            xhr.send(pendingVideoFile);
          });

          if (result.success && result.publicUrl) {
            newVideoUrl = result.publicUrl;
            setVideoUrl(newVideoUrl);
            setPendingVideoFile(null);
            setVideoToDelete(null);
          } else {
            throw new Error(result.error || "Failed to upload video");
          }
        } else if (deletedVideoUrl) {
          const deleteResult = await deleteFileFromStorage(deletedVideoUrl);
          if (!deleteResult.success) {
            console.error("Failed to delete video:", deleteResult.error);
          }
          setVideoToDelete(null);
        }

        return {
          videoUrl: newVideoUrl,
          deletedVideoUrl,
        };
      },
    }));

    const renderSection = (section: TemplateSectionConfig) => {
      switch (section.type) {
        case "header":
          return renderHeaderSection(section);
        case "static-title":
          return renderStaticTitle(section);
        case "richtext":
          return renderRichTextSection(section);
        case "two-column":
          return renderTwoColumnSection(section);
        default:
          return null;
      }
    };

    const renderHeaderSection = (section: TemplateSectionConfig) => {
      const titleField = section.fields.find((f) => f.id === "headerTitle");
      const subtitleField = section.fields.find((f) => f.id === "headerSubtitle");

      const title = (content[titleField?.id || ""] as string) || (titleField?.defaultValue as string) || "Personal Bio";

      return (
        <VideoHeaderSection
          key={section.id}
          title={title}
          subtitle={(content[subtitleField?.id || ""] as string) || ""}
          videoUrl={videoUrl}
          pendingVideoFile={pendingVideoFile}
          onTitleChange={(value) =>
            handleFieldChange(titleField?.id || "headerTitle", value)
          }
          onSubtitleChange={(value) =>
            handleFieldChange(subtitleField?.id || "headerSubtitle", value)
          }
          onVideoSelect={handleVideoSelect}
          readOnly={readOnly}
          isTitleMissing={missingFields.has("headerTitle")}
          isSubtitleMissing={missingFields.has("headerSubtitle")}
        />
      );
    };

    const renderStaticTitle = (section: TemplateSectionConfig) => {
      const titleField = section.fields[0];
      const title =
        (content[titleField?.id || ""] as string) || (titleField?.defaultValue as string) || "";

      return (
        <div key={section.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center mb-0.5">
            <span className="text-xs text-zinc-500">This title cannot be edited</span>
          </div>
          <StaticTitle title={title} />
        </div>
      );
    };

    const renderRichTextSection = (section: TemplateSectionConfig) => {
      const field = section.fields[0];
      if (!field) return null;

      return (
          <RichTextSection
            fieldId={field.id}
            label={field.label}
            placeholder={field.placeholder}
            value={(content[field.id] as string) || ""}
            onChange={handleFieldChange}
            readOnly={readOnly || !field.editable}
            isMissing={missingFields.has(field.id)}
          />
      );
    };

    const renderTwoColumnSection = (section: TemplateSectionConfig) => {
      if (!section.columns) return null;

      return (
        <div key={section.id} className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="font-bold text-zinc-900 mb-4">
            Goals & Challenges
          </h2>
          <TwoColumnSection
            leftFields={section.columns.left}
            rightFields={section.columns.right}
            content={content}
            onChange={handleFieldChange}
            readOnly={readOnly}
            missingFields={missingFields}
          />
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <TemplateSelector
          selectedTemplateId={selectedTemplateId}
          onSelect={(newTemplate) => setSelectedTemplateId(newTemplate.id)}
          disabled={readOnly}
        />

        <div className="space-y-6">
          {template.sections.map(renderSection)}
        </div>
      </div>
    );
  }
);
