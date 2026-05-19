import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { Trash2 } from "lucide-react";

type ColumnNodeViewProps = {
  deleteNode: () => void;
};

export function ColumnNodeView({ deleteNode }: ColumnNodeViewProps) {
  return (
    <NodeViewWrapper className="tiptap-column-wrapper">
      <button
        type="button"
        className="tiptap-column-delete"
        onClick={deleteNode}
        contentEditable={false}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <div className="tiptap-column">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}


