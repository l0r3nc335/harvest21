"use client";

import { useEffect, useMemo } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Code2,
  Columns as ColumnsIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { Columns, Column } from "./extensions/Columns";
import { ImageWithDelete } from "./extensions/ImageWithDelete";
import { VideoWithDelete } from "./extensions/VideoWithDelete";
import { isRasterImageFile, RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";

export type RichEditorProps = {
  content: JSONContent | null;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function RichEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  disabled = false,
}: RichEditorProps) {
  const initialContent = useMemo<JSONContent>(
    () =>
      content ?? {
        type: "doc",
        content: [
          {
            type: "paragraph",
          },
        ],
      },
    [content],
  );

  const editor = useEditor({
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
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      ImageWithDelete.configure({
        inline: false,
        HTMLAttributes: {
          class: "tiptap-image",
        },
      }),
      VideoWithDelete.configure({
        inline: false,
        HTMLAttributes: {
          class: "tiptap-video",
        },
      }),
      Columns,
      Column,
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange(json);
    },
  });

  useEffect(() => {
    if (!editor || !content) return;
    const current = editor.getJSON();
    const next = content;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, content]);

  const insertImage = () => {
    if (!editor || !editor.isEditable) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = RASTER_IMAGE_INPUT_ACCEPT;
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (!file) return;
      if (!isRasterImageFile(file)) {
        console.error("Only JPEG, PNG, GIF, WebP, or AVIF images are allowed.");
        return;
      }
      const url = URL.createObjectURL(file);
      editor
        .chain()
        .focus()
        .setImage({
          src: url,
        })
        .run();
    };
    input.click();
  };

  const insertVideo = () => {
    if (!editor || !editor.isEditable) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      editor
        .chain()
        .focus()
        .setVideo({
          src: url,
        })
        .run();
    };
    input.click();
  };

  if (!editor) {
    return null;
  }

  const isDisabled = disabled || !editor.isEditable;

  const button = (
    opts: {
      label: string;
      icon: React.ElementType;
      active?: boolean;
      onClick: () => void;
    },
  ) => (
    <button
      type="button"
      aria-label={opts.label}
      className={`tiptap-toolbar-button${opts.active ? " is-active" : ""}`}
      disabled={isDisabled}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isDisabled) return;
        opts.onClick();
      }}
    >
      <opts.icon />
    </button>
  );

  return (
    <div className="tiptap-root">
      <div className="tiptap-editor-shell">
        <div className="tiptap-editor-toolbar">
          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Bold",
              icon: Bold,
              active: editor.isActive("bold"),
              onClick: () => {
                editor.chain().focus().toggleBold().run();
              },
            })}
            {button({
              label: "Italic",
              icon: Italic,
              active: editor.isActive("italic"),
              onClick: () => {
                editor.chain().focus().toggleItalic().run();
              },
            })}
            {button({
              label: "Underline",
              icon: UnderlineIcon,
              active: editor.isActive("underline"),
              onClick: () => {
                editor.chain().focus().toggleUnderline().run();
              },
            })}
            {button({
              label: "Highlight",
              icon: Highlighter,
              active: editor.isActive("highlight"),
              onClick: () => {
                editor.chain().focus().toggleHighlight().run();
              },
            })}
          </div>

          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Heading 1",
              icon: Heading1,
              active: editor.isActive("heading", { level: 1 }),
              onClick: () => {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
              },
            })}
            {button({
              label: "Heading 2",
              icon: Heading2,
              active: editor.isActive("heading", { level: 2 }),
              onClick: () => {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              },
            })}
            {button({
              label: "Heading 3",
              icon: Heading3,
              active: editor.isActive("heading", { level: 3 }),
              onClick: () => {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
              },
            })}
            {button({
              label: "Heading 4",
              icon: Heading4,
              active: editor.isActive("heading", { level: 4 }),
              onClick: () => {
                editor.chain().focus().toggleHeading({ level: 4 }).run();
              },
            })}
            {button({
              label: "Heading 5",
              icon: Heading5,
              active: editor.isActive("heading", { level: 5 }),
              onClick: () => {
                editor.chain().focus().toggleHeading({ level: 5 }).run();
              },
            })}
          </div>

          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Bullet list",
              icon: List,
              active: editor.isActive("bulletList"),
              onClick: () => {
                editor.chain().focus().toggleBulletList().run();
              },
            })}
            {button({
              label: "Ordered list",
              icon: ListOrdered,
              active: editor.isActive("orderedList"),
              onClick: () => {
                editor.chain().focus().toggleOrderedList().run();
              },
            })}
            {button({
              label: "Code block",
              icon: Code2,
              active: editor.isActive("codeBlock"),
              onClick: () => {
                editor.chain().focus().toggleCodeBlock().run();
              },
            })}
          </div>

          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Align left",
              icon: AlignLeft,
              active: editor.isActive({ textAlign: "left" }),
              onClick: () => {
                editor.chain().focus().setTextAlign("left").run();
              },
            })}
            {button({
              label: "Align center",
              icon: AlignCenter,
              active: editor.isActive({ textAlign: "center" }),
              onClick: () => {
                editor.chain().focus().setTextAlign("center").run();
              },
            })}
            {button({
              label: "Align right",
              icon: AlignRight,
              active: editor.isActive({ textAlign: "right" }),
              onClick: () => {
                editor.chain().focus().setTextAlign("right").run();
              },
            })}
            {button({
              label: "Justify",
              icon: AlignJustify,
              active: editor.isActive({ textAlign: "justify" }),
              onClick: () => {
                editor.chain().focus().setTextAlign("justify").run();
              },
            })}
          </div>

          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Two columns",
              icon: ColumnsIcon,
              onClick: () => {
                editor.chain().focus().setColumns(2).run();
              },
            })}
            {button({
              label: "Three columns",
              icon: ColumnsIcon,
              onClick: () => {
                editor.chain().focus().setColumns(3).run();
              },
            })}
          </div>

          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Insert image",
              icon: ImageIcon,
              onClick: insertImage,
            })}
            {button({
              label: "Insert video",
              icon: VideoIcon,
              onClick: insertVideo,
            })}
          </div>

          <div className="tiptap-editor-toolbar-group">
            {button({
              label: "Undo",
              icon: Undo2,
              onClick: () => {
                editor.chain().focus().undo().run();
              },
            })}
            {button({
              label: "Redo",
              icon: Redo2,
              onClick: () => {
                editor.chain().focus().redo().run();
              },
            })}
          </div>
        </div>

        <div className="tiptap-editor-body">
          <div className="tiptap-editor-content">
            <EditorContent editor={editor} className="tiptap" />
          </div>
        </div>
      </div>
    </div>
  );
}


