import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeViewRenderer } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Trash2 } from 'lucide-react';

let ReactNodeViewRenderer: any;
if (typeof window !== 'undefined') {
  ReactNodeViewRenderer = require('@tiptap/react').ReactNodeViewRenderer;
}

const ImageComponent = ({ node, deleteNode, extension }: { node: any; deleteNode: () => void; extension: any }) => {
  const handleDelete = () => {
    const src = node.attrs.src;
    if (src && extension.options.onDelete) {
      extension.options.onDelete(src);
    }
    deleteNode();
  };

  return (
    <NodeViewWrapper className="tiptap-media-wrapper">
      <div>
        <img src={node.attrs.src} alt={node.attrs.alt || ''} className="tiptap-image" />
        <button
          className="tiptap-media-delete"
          onClick={handleDelete}
          type="button"
          contentEditable={false}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export interface ImageOptions {
  inline: boolean;
  HTMLAttributes: Record<string, any>;
  onDelete?: (src: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageWithDelete: {
      setImage: (options: { src: string; alt?: string }) => ReturnType;
    };
  }
}

export const ImageWithDelete = Node.create<ImageOptions>({
  name: 'image',

  addOptions() {
    return {
      inline: false,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView(): NodeViewRenderer | null {
    if (typeof window === 'undefined' || !ReactNodeViewRenderer) {
      return null;
    }
    return ReactNodeViewRenderer(ImageComponent);
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

