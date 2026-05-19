"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { FooterRichTextEditor } from "./FooterRichTextEditor";

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

type FAQEditorProps = {
  items: FAQItem[];
  onChange: (items: FAQItem[]) => void;
};

export function FAQEditor({ items, onChange }: FAQEditorProps) {
  const handleAddItem = () => {
    const newItem: FAQItem = {
      id: `faq-${Date.now()}`,
      question: "",
      answer: "",
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: "question" | "answer", value: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleMoveItem = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    ) {
      return;
    }

    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          Add frequently asked questions and their answers
        </p>
        <Button
          type="button"
          onClick={handleAddItem}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </Button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
          <p className="text-zinc-500 text-sm">No FAQ items yet. Click "Add Question" to get started.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => handleMoveItem(index, "up")}
                  disabled={index === 0}
                  className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveItem(index, "down")}
                  disabled={index === items.length - 1}
                  className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <GripVertical className="w-4 h-4 rotate-180" />
                </button>
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Question {index + 1}
                  </label>
                  <Input
                    value={item.question}
                    onChange={(e) => handleUpdateItem(item.id, "question", e.target.value)}
                    placeholder="Enter the question..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Answer
                  </label>
                  <FooterRichTextEditor
                    content={item.answer || ""}
                    onChange={(html) => handleUpdateItem(item.id, "answer", html)}
                    placeholder="Enter the answer..."
                    resizable={true}
                    initialHeight={250}
                    minHeight={250}
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Use the toolbar to format your content with headings, bold, italic, lists, links, and indentation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors mt-6"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

