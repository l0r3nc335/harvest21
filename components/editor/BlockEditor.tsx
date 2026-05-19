"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import type { KeyboardEvent } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { ImageWithDelete } from "./extensions/ImageWithDelete";
import { VideoWithDelete } from "./extensions/VideoWithDelete";
import { Columns, Column } from "./extensions/Columns";
import {
  Image as ImageIcon,
  Minus,
  Eye,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Video as VideoIcon,
  Columns as ColumnsIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { editorDataToHTML, htmlToEditorData } from "@/components/editor/utils";
import type { OutputData } from "@/components/editor/types";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";
import { isRasterImageFile, RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";
import "./editor.css";

type BlockEditorProps = {
  data?: OutputData;
  onChange?: (data: OutputData) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onUploadVideo?: (file: File) => Promise<string>;
  onDeleteFile?: (url: string) => Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
};

export type PendingUpload = {
  id: string;
  file: File;
  type: "image" | "video";
  previewUrl: string;
};

export type PendingDeletion = {
  url: string;
};

type ToolbarButtonConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  action: () => boolean | Promise<boolean>;
  isActive?: () => boolean;
  disabled?: boolean;
};

type ToolbarButtonProps = {
  config: ToolbarButtonConfig;
  disabled: boolean;
  editor: Editor | null;
};

const runToolbarAction = (label: string, action: () => boolean | Promise<boolean>) => {
  try {
    const result = action();
    if (result instanceof Promise) {
      result
        .then((success) => {
          if (!success) {
            console.error(`[Editor Toolbar] ${label} action failed`);
          }
        })
        .catch((error) => {
          console.error(`[Editor Toolbar] ${label} action error`, error);
        });
      return;
    }

    if (!result) {
      console.error(`[Editor Toolbar] ${label} action failed`);
    }
  } catch (error) {
    console.error(`[Editor Toolbar] ${label} action error`, error);
  }
};

const ToolbarButton = ({ config, disabled, editor }: ToolbarButtonProps) => {
  const Icon = config.icon;
  const isActive = config.isActive?.() ?? false;
  const isDisabled = disabled || !!config.disabled;
  
  const triggerAction = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled || !editor) return;
    
    editor.view.dom.focus();
    
    setTimeout(() => {
      runToolbarAction(config.label, config.action);
    }, 10);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    triggerAction(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled || !editor) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      editor.view.dom.focus();
      setTimeout(() => {
        runToolbarAction(config.label, config.action);
      }, 10);
    }
  };

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`block-editor-block-btn ${isActive ? 'active' : ''}`}
      disabled={isDisabled}
      title={config.label}
      tabIndex={-1}
    >
      <Icon className="block-editor-block-icon" />
    </button>
  );
};

export type BlockEditorHandle = {
  processPendingUploadsAndDeletions: () => Promise<{ uploads: PendingUpload[]; deletions: PendingDeletion[] }>;
  getEditorData: () => Promise<OutputData | null>;
  getHTML: () => string;
};

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor({
  data,
  onChange,
  onUploadImage,
  onUploadVideo,
  onDeleteFile,
  placeholder = "Start writing...",
  readOnly = false,
}, ref) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>("");
  const onChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Map<string, PendingUpload>>(new Map());
  const previousMediaRef = useRef<Set<string>>(new Set());
  const hasHydratedRef = useRef(false);

  const initialHTML = data && data.blocks && data.blocks.length > 0 ? editorDataToHTML(data) : "";

  useEffect(() => {
    if (!data) return;
    const mediaUrls = new Set<string>();
    data.blocks?.forEach((block) => {
      if (block.type === "image" || block.type === "video") {
        const url = block.data.url as string;
        if (url && !url.startsWith("blob:") && !url.startsWith("data:")) {
          mediaUrls.add(url);
        }
      }
    });
    previousMediaRef.current = mediaUrls;
  }, [data]);

  const handleMediaDelete = (src: string) => {
    if (src.startsWith('blob:')) {
      const upload = Array.from(pendingUploads.values()).find(u => u.previewUrl === src);
      if (upload) {
        URL.revokeObjectURL(upload.previewUrl);
        setPendingUploads(prev => {
          const next = new Map(prev);
          next.delete(upload.id);
          return next;
        });
      }
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5],
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: false,
      }),
      ImageWithDelete.configure({
        inline: false,
        HTMLAttributes: {
          class: 'tiptap-image',
        },
        onDelete: handleMediaDelete,
      }),
      VideoWithDelete.configure({
        inline: false,
        HTMLAttributes: {
          class: 'tiptap-video',
        },
        onDelete: handleMediaDelete,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Columns,
      Column,
    ],
    content: initialHTML,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        if (onChangeTimeoutRef.current) {
          clearTimeout(onChangeTimeoutRef.current);
        }
        onChangeTimeoutRef.current = setTimeout(() => {
          const html = editor.getHTML();
          const outputData = htmlToEditorData(html);
          onChange(outputData);
        }, 300);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (hasHydratedRef.current) return;

    if (data && data.blocks && data.blocks.length > 0) {
      const newHTML = editorDataToHTML(data);
      editor.commands.setContent(newHTML, { emitUpdate: false });
    }

    hasHydratedRef.current = true;
  }, [editor, data]);


  useEffect(() => {
    return () => {
      if (onChangeTimeoutRef.current) {
        clearTimeout(onChangeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      pendingUploads.forEach(upload => {
        URL.revokeObjectURL(upload.previewUrl);
      });
    };
  }, [pendingUploads]);

  useImperativeHandle(ref, () => ({
    processPendingUploadsAndDeletions: async () => {
      const uploads: PendingUpload[] = Array.from(pendingUploads.values());
      const deletions: PendingDeletion[] = [];

      if (!editor) return { uploads, deletions };

      const html = editor.getHTML();
      const currentMediaUrls = new Set<string>();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      doc.querySelectorAll('img, video').forEach((el) => {
        const url = el.tagName === 'IMG' 
          ? (el as HTMLImageElement).src 
          : (el as HTMLVideoElement).src;
        if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
          currentMediaUrls.add(url);
        }
      });

      previousMediaRef.current.forEach((url) => {
        if (!currentMediaUrls.has(url)) {
          deletions.push({ url });
        }
      });

      for (const upload of uploads) {
        try {
          const uploadFn = upload.type === 'image' ? onUploadImage : onUploadVideo;
          if (uploadFn) {
            const uploadedUrl = await uploadFn(upload.file);
            
            if (editor) {
              const html = editor.getHTML();
              const updatedHtml = html.replace(upload.previewUrl, uploadedUrl);
              editor.commands.setContent(updatedHtml);
            }

            URL.revokeObjectURL(upload.previewUrl);
            setPendingUploads(prev => {
              const next = new Map(prev);
              next.delete(upload.id);
              return next;
            });
          }
        } catch (error) {
          console.error(`Error uploading ${upload.type}:`, error);
        }
      }

      for (const deletion of deletions) {
        try {
          if (onDeleteFile) {
            await onDeleteFile(deletion.url);
          }
        } catch (error) {
          console.error("Error deleting file:", error);
        }
      }

      if (editor) {
        const html = editor.getHTML();
        const currentUrls = new Set<string>();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        doc.querySelectorAll('img, video').forEach((el) => {
          const url = el.tagName === 'IMG' 
            ? (el as HTMLImageElement).src 
            : (el as HTMLVideoElement).src;
          if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
            currentUrls.add(url);
          }
        });
        
        previousMediaRef.current = currentUrls;
      }

      return { uploads, deletions };
    },
    getEditorData: async () => {
      if (!editor) return null;
      const html = editor.getHTML();
      return htmlToEditorData(html);
    },
    getHTML: () => {
      if (!editor) return "";
      return editor.getHTML();
    },
  }));

  const handlePreview = () => {
    if (!editor) return;
    const html = editor.getHTML();
    setPreviewContent(html);
    setShowPreview(true);
  };

  const addImage = () => {
    if (!editor) return false;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = RASTER_IMAGE_INPUT_ACCEPT;

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && !isRasterImageFile(file)) {
        console.error("Only JPEG, PNG, GIF, WebP, or AVIF images are allowed.");
        return;
      }
      if (file) {
        const id = `${Date.now()}-${Math.random()}`;
        const previewUrl = URL.createObjectURL(file);

        const upload: PendingUpload = {
          id,
          file,
          type: 'image',
          previewUrl,
        };

        setPendingUploads(prev => new Map(prev).set(id, upload));
        const inserted = editor.chain().focus().setImage({ src: previewUrl }).run();
        if (!inserted) {
          console.error("Failed to insert image preview");
        }
      }
    };

    input.click();
    return true;
  };

  const addVideo = () => {
    if (!editor) return false;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const id = `${Date.now()}-${Math.random()}`;
        const previewUrl = URL.createObjectURL(file);

        const upload: PendingUpload = {
          id,
          file,
          type: 'video',
          previewUrl,
        };

        setPendingUploads(prev => new Map(prev).set(id, upload));
        const inserted = editor.chain().focus().setVideo({ src: previewUrl }).run();
        if (!inserted) {
          console.error("Failed to insert video preview");
        }
      }
    };

    input.click();
    return true;
  };

  const withEditor = (command: (instance: Editor) => boolean) => () => {
    if (!editor) return false;
    if (!editor.isEditable) return false;
    const result = command(editor);
    return result;
  };

  const toolbarButtons: ToolbarButtonConfig[] = [
    {
      id: "bold",
      label: "Bold",
      icon: BoldIcon,
      isActive: () => !!editor?.isActive("bold"),
      action: withEditor((instance) => instance.chain().focus().toggleBold().run()),
    },
    {
      id: "italic",
      label: "Italic",
      icon: ItalicIcon,
      isActive: () => !!editor?.isActive("italic"),
      action: withEditor((instance) => instance.chain().focus().toggleItalic().run()),
    },
    {
      id: "underline",
      label: "Underline",
      icon: UnderlineIcon,
      isActive: () => !!editor?.isActive("underline"),
      action: withEditor((instance) => instance.chain().focus().toggleUnderline().run()),
    },
    {
      id: "highlight",
      label: "Highlight",
      icon: Highlighter,
      isActive: () => !!editor?.isActive("highlight"),
      action: withEditor((instance) => instance.chain().focus().toggleHighlight().run()),
    },
    {
      id: "h1",
      label: "Heading 1",
      icon: Heading1,
      isActive: () => !!editor?.isActive("heading", { level: 1 }),
      action: withEditor((instance) => instance.chain().focus().toggleHeading({ level: 1 }).run()),
    },
    {
      id: "h2",
      label: "Heading 2",
      icon: Heading2,
      isActive: () => !!editor?.isActive("heading", { level: 2 }),
      action: withEditor((instance) => instance.chain().focus().toggleHeading({ level: 2 }).run()),
    },
    {
      id: "h3",
      label: "Heading 3",
      icon: Heading3,
      isActive: () => !!editor?.isActive("heading", { level: 3 }),
      action: withEditor((instance) => instance.chain().focus().toggleHeading({ level: 3 }).run()),
    },
    {
      id: "h4",
      label: "Heading 4",
      icon: Heading4,
      isActive: () => !!editor?.isActive("heading", { level: 4 }),
      action: withEditor((instance) => instance.chain().focus().toggleHeading({ level: 4 }).run()),
    },
    {
      id: "h5",
      label: "Heading 5",
      icon: Heading5,
      isActive: () => !!editor?.isActive("heading", { level: 5 }),
      action: withEditor((instance) => instance.chain().focus().toggleHeading({ level: 5 }).run()),
    },
    {
      id: "bullet",
      label: "Bullet List",
      icon: List,
      isActive: () => !!editor?.isActive("bulletList"),
      action: withEditor((instance) => instance.chain().focus().toggleBulletList().run()),
    },
    {
      id: "ordered",
      label: "Numbered List",
      icon: ListOrdered,
      isActive: () => !!editor?.isActive("orderedList"),
      action: withEditor((instance) => instance.chain().focus().toggleOrderedList().run()),
    },
    {
      id: "align-left",
      label: "Align Left",
      icon: AlignLeft,
      isActive: () => !!editor?.isActive({ textAlign: "left" }),
      action: withEditor((instance) => instance.chain().focus().setTextAlign("left").run()),
    },
    {
      id: "align-center",
      label: "Align Center",
      icon: AlignCenter,
      isActive: () => !!editor?.isActive({ textAlign: "center" }),
      action: withEditor((instance) => instance.chain().focus().setTextAlign("center").run()),
    },
    {
      id: "align-right",
      label: "Align Right",
      icon: AlignRight,
      isActive: () => !!editor?.isActive({ textAlign: "right" }),
      action: withEditor((instance) => instance.chain().focus().setTextAlign("right").run()),
    },
    {
      id: "align-justify",
      label: "Justify",
      icon: AlignJustify,
      isActive: () => !!editor?.isActive({ textAlign: "justify" }),
      action: withEditor((instance) => instance.chain().focus().setTextAlign("justify").run()),
    },
    {
      id: "image",
      label: "Image",
      icon: ImageIcon,
      action: addImage,
    },
    {
      id: "video",
      label: "Video",
      icon: VideoIcon,
      action: addVideo,
    },
    {
      id: "columns-2",
      label: "2 Columns",
      icon: ColumnsIcon,
      action: withEditor((instance) =>
        instance.chain().focus().setColumns(2).run(),
      ),
    },
    {
      id: "columns-3",
      label: "3 Columns",
      icon: ColumnsIcon,
      action: withEditor((instance) =>
        instance.chain().focus().setColumns(3).run(),
      ),
    },
    {
      id: "hr",
      label: "Divider",
      icon: Minus,
      action: withEditor((instance) => instance.chain().focus().setHorizontalRule().run()),
    },
  ];

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <>
      <div className="block-editor-container">
        <div className="block-editor-layout">
          <div className="block-editor-sidebar block-editor-sidebar-left">
            <div className="block-editor-sidebar-content">
              {toolbarButtons.map((button) => (
                <ToolbarButton key={button.id} config={button} disabled={readOnly} editor={editor} />
              ))}
            </div>
          </div>

          <div className="block-editor-main">
            <EditorContent editor={editor} className="block-editor-canvas" />
          </div>
        </div>
        <div className="block-editor-preview-section">
          {pendingUploads.size > 0 && (
            <span className="text-sm text-yellow-600 mr-4">
              {pendingUploads.size} pending upload{pendingUploads.size > 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="secondary"
            onClick={handlePreview}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Preview"
        size="fullscreen"
      >
        <div className="prose max-w-none h-full overflow-y-auto">
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(previewContent) }} />
        </div>
      </Modal>
    </>
  );
});
