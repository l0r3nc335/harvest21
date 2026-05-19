"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Indent,
  Outdent,
  GripVertical,
} from "lucide-react";
import { useEffect, useCallback, useRef, useState } from "react";
import { Indent as IndentExtension } from "@/components/editor/extensions/Indent";
import "@/components/editor/editor.css";

type FooterRichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  resizable?: boolean;
  initialHeight?: number;
  minHeight?: number;
};

export function FooterRichTextEditor({
  content,
  onChange,
  placeholder = "Enter content...",
  resizable = false,
  initialHeight,
  minHeight = 250,
}: FooterRichTextEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(initialHeight || minHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [hasManualResize, setHasManualResize] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      IndentExtension.configure({
        types: ['paragraph', 'heading'],
        minLevel: 0,
        maxLevel: 8,
        defaultLevel: 0,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return;
    editor.commands.setContent(content, { emitUpdate: false });
    // Reset initial load flag when content changes externally
    setIsInitialLoad(true);
  }, [editor, content]);

  // Always start at initialHeight on first load
  useEffect(() => {
    if (!resizable || !isInitialLoad) return;
    // Ensure we start at initialHeight regardless of content
    setHeight(initialHeight || minHeight);
  }, [resizable, initialHeight, minHeight, isInitialLoad]);

  // Auto-expand height based on content when user is typing (not on initial load)
  useEffect(() => {
    if (!resizable || !editorContentRef.current || !editor || isInitialLoad) return;
    
    const calculateHeight = () => {
      if (editorContentRef.current && !hasManualResize) {
        // Get the actual content height
        const contentElement = editorContentRef.current.querySelector('.ProseMirror');
        if (contentElement) {
          const scrollHeight = contentElement.scrollHeight;
          const calculatedHeight = Math.max(
            initialHeight || minHeight, 
            scrollHeight + 32 // 32px for padding (p-4 = 16px top + 16px bottom)
          );
          // Only auto-expand if user hasn't manually resized and content is taller
          if (!isResizing && calculatedHeight > height) {
            setHeight(calculatedHeight);
          }
        }
      }
    };
    
    // Recalculate on content updates (but only if not manually resized and not initial load)
    const handleUpdate = () => {
      if (!isResizing && !hasManualResize && !isInitialLoad) {
        setTimeout(calculateHeight, 50);
      }
    };

    editor.on("update", handleUpdate);
    
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, resizable, initialHeight, minHeight, isResizing, hasManualResize, height, isInitialLoad]);

  // Mark initial load as complete after editor is ready
  useEffect(() => {
    if (!editor || !resizable) return;
    
    const handleCreate = () => {
      // Wait a bit for content to render, then mark initial load as complete
      setTimeout(() => {
        setIsInitialLoad(false);
      }, 200);
    };

    editor.on("create", handleCreate);
    
    return () => {
      editor.off("create", handleCreate);
    };
  }, [editor, resizable]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!resizable || !editorContainerRef.current) return;
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = editorContainerRef.current.offsetHeight;
  }, [resizable]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!editorContainerRef.current) return;
      const diff = e.clientY - resizeStartY.current;
      const newHeight = Math.max(minHeight, resizeStartHeight.current + diff);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setHasManualResize(true); // Mark that user has manually resized
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minHeight]);

  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div 
      ref={editorContainerRef}
      className="border border-zinc-300 rounded-md overflow-hidden flex flex-col"
      style={resizable ? { height: `${height}px` } : {}}
    >
      <div className="bg-zinc-50 border-b border-zinc-300 p-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("heading", { level: 1 }) ? "bg-zinc-300" : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("heading", { level: 2 }) ? "bg-zinc-300" : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("heading", { level: 3 }) ? "bg-zinc-300" : ""
          }`}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <div className="w-px bg-zinc-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("bold") ? "bg-zinc-300" : ""
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("italic") ? "bg-zinc-300" : ""
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("underline") ? "bg-zinc-300" : ""
          }`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <div className="w-px bg-zinc-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("bulletList") ? "bg-zinc-300" : ""
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("orderedList") ? "bg-zinc-300" : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px bg-zinc-300 mx-1" />
        <button
          type="button"
          onClick={setLink}
          className={`p-2 rounded hover:bg-zinc-200 ${
            editor.isActive("link") ? "bg-zinc-300" : ""
          }`}
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <div className="w-px bg-zinc-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().indent().run()}
          className="p-2 rounded hover:bg-zinc-200"
          title="Indent (Tab)"
        >
          <Indent className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().outdent().run()}
          className="p-2 rounded hover:bg-zinc-200"
          title="Outdent (Shift+Tab)"
        >
          <Outdent className="w-4 h-4" />
        </button>
      </div>
      <div 
        ref={editorContentRef}
        className="flex-1 overflow-auto"
        style={resizable ? { minHeight: `${minHeight}px` } : {}}
      >
        <EditorContent 
          editor={editor} 
          className={`prose max-w-none p-4 focus:outline-none ${resizable ? "" : "min-h-[400px]"}`}
        />
      </div>
      {resizable && (
        <div
          onMouseDown={handleMouseDown}
          className={`h-2 bg-zinc-200 hover:bg-zinc-300 cursor-ns-resize flex items-center justify-center transition-colors ${
            isResizing ? "bg-zinc-400" : ""
          }`}
          title="Drag to resize"
        >
          <GripVertical className="w-4 h-4 text-zinc-500 rotate-90" />
        </div>
      )}
    </div>
  );
}

