import { Node, mergeAttributes } from '@tiptap/core';
import type { NodeViewRenderer } from '@tiptap/core';
import { ColumnNodeView } from './ColumnNodeView';

let ReactNodeViewRenderer: any;
if (typeof window !== 'undefined') {
  ReactNodeViewRenderer = require('@tiptap/react').ReactNodeViewRenderer;
}

export interface ColumnsOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (columns: number) => ReturnType;
    };
  }
}

export const Columns = Node.create<ColumnsOptions>({
  name: 'columns',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'column+',

  addAttributes() {
    return {
      columns: {
        default: 2,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columns"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'columns', 'data-columns': HTMLAttributes.columns }),
      0,
    ];
  },

  addCommands() {
    return {
      setColumns:
        (columns) =>
        ({ chain, state }) => {
          const normalizedColumns = Math.max(2, columns);
          
          if (state.selection.$from.parent.type.name === 'column') {
            return false;
          }

          const columnNodes = Array.from({ length: normalizedColumns }, () => ({
            type: 'column',
            content: [{ type: 'paragraph' }],
          }));

          const columnsNode = {
            type: this.name,
            attrs: { columns: normalizedColumns },
            content: columnNodes,
          };

          return chain()
            .focus()
            .insertContent(columnsNode)
            .insertContent({ type: 'paragraph' })
            .run();
        },
    };
  },
});

export const Column = Node.create({
  name: 'column',

  group: 'column',

  content: 'block+',

  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ];
  },

  renderHTML() {
    return ['div', { 'data-type': 'column' }, 0];
  },

  addNodeView(): NodeViewRenderer | null {
    if (typeof window === 'undefined' || !ReactNodeViewRenderer) {
      return null;
    }
    return ReactNodeViewRenderer(ColumnNodeView);
  },
});

