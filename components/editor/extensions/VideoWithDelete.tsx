import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeViewRenderer } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Trash2 } from 'lucide-react';

let ReactNodeViewRenderer: any;
if (typeof window !== 'undefined') {
  ReactNodeViewRenderer = require('@tiptap/react').ReactNodeViewRenderer;
}

const VideoComponent = ({ node, deleteNode, extension }: { node: any; deleteNode: () => void; extension: any }) => {
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
        <video src={node.attrs.src} controls className="tiptap-video" />
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

export interface VideoOptions {
  inline: boolean;
  HTMLAttributes: Record<string, any>;
  onDelete?: (src: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoWithDelete: {
      setVideo: (options: { src: string; caption?: string }) => ReturnType;
    };
  }
}

export const VideoWithDelete = Node.create<VideoOptions>({
  name: 'video',

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
      caption: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { controls: true })];
  },

  addNodeView(): NodeViewRenderer | null {
    if (typeof window === 'undefined' || !ReactNodeViewRenderer) {
      return null;
    }
    return ReactNodeViewRenderer(VideoComponent);
  },

  addCommands() {
    return {
      setVideo:
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

