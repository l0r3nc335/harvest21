import { Extension } from '@tiptap/core';

export interface IndentOptions {
  types: string[];
  minLevel: number;
  maxLevel: number;
  defaultLevel: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /**
       * Increase the indentation level
       */
      indent: () => ReturnType;
      /**
       * Decrease the indentation level
       */
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      minLevel: 0,
      maxLevel: 8,
      defaultLevel: 0,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indentLevel: {
            default: this.options.defaultLevel,
            parseHTML: (element) => {
              const level = parseInt(element.getAttribute('data-indent-level') || '0', 10);
              return Math.max(this.options.minLevel, Math.min(this.options.maxLevel, level));
            },
            renderHTML: (attributes) => {
              if (attributes.indentLevel === this.options.defaultLevel) {
                return {};
              }
              return {
                'data-indent-level': attributes.indentLevel,
                style: `margin-left: ${attributes.indentLevel * 2}rem;`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { $from, $to } = selection;

          let hasChanges = false;

          state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentLevel = node.attrs.indentLevel || this.options.defaultLevel;
              const newLevel = Math.min(this.options.maxLevel, currentLevel + 1);

              if (newLevel !== currentLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indentLevel: newLevel,
                });
                hasChanges = true;
              }
            }
          });

          if (hasChanges && dispatch) {
            dispatch(tr);
            return true;
          }

          return false;
        },
      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { $from, $to } = selection;

          let hasChanges = false;

          state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentLevel = node.attrs.indentLevel || this.options.defaultLevel;
              const newLevel = Math.max(this.options.minLevel, currentLevel - 1);

              if (newLevel !== currentLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indentLevel: newLevel,
                });
                hasChanges = true;
              }
            }
          });

          if (hasChanges && dispatch) {
            dispatch(tr);
            return true;
          }

          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { selection } = this.editor.state;
        const { $from } = selection;

        // Check if we're in a list - if so, let TipTap handle it natively
        const node = $from.node(-1);
        if (node && (node.type.name === 'bulletList' || node.type.name === 'orderedList')) {
          return false;
        }

        // Check if we're in a paragraph or heading
        const currentNode = $from.parent;
        if (!this.options.types.includes(currentNode.type.name)) {
          return false;
        }

        // Prevent default Tab behavior and indent instead
        const result = this.editor.commands.indent();
        return result;
      },
      'Shift-Tab': () => {
        const { selection } = this.editor.state;
        const { $from } = selection;

        // Check if we're in a list - if so, let TipTap handle it natively
        const node = $from.node(-1);
        if (node && (node.type.name === 'bulletList' || node.type.name === 'orderedList')) {
          return false;
        }

        // Check if we're in a paragraph or heading
        const currentNode = $from.parent;
        if (!this.options.types.includes(currentNode.type.name)) {
          return false;
        }

        // Prevent default Shift+Tab behavior and outdent instead
        const result = this.editor.commands.outdent();
        return result;
      },
    };
  },
});
