import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import { Columns, Column } from "./extensions/Columns";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";

const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      src: {
        default: null,
      },
      caption: {
        default: "",
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "video[src]",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: true })];
  },
});

export type RichContentProps = {
  content: JSONContent | null;
};

export function RichContent({ content }: RichContentProps) {
  const doc: JSONContent =
    content ??
    ({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    } satisfies JSONContent);

  const html = generateHTML(doc, [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5],
      },
    }),
    Underline,
    Highlight.configure({
      multicolor: false,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
      defaultAlignment: "left",
    }),
    Image.configure({
      HTMLAttributes: {
        class: "tiptap-image",
      },
    }),
    Video,
    Columns,
    Column,
  ]);

  const safeHtml = sanitizeHtmlForDisplay(html);

  return (
    <div className="tiptap-viewer">
      <div className="tiptap" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  );
}


