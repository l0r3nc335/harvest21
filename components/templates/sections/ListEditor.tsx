"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ListEditorProps = {
  fieldId: string;
  label: string;
  placeholder?: string;
  items: string[];
  onChange: (fieldId: string, items: string[]) => void;
  readOnly?: boolean;
  isMissing?: boolean;
};

export function ListEditor({
  fieldId,
  label,
  placeholder = "Add item",
  items,
  onChange,
  readOnly = false,
  isMissing = false,
}: ListEditorProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange(fieldId, [...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(fieldId, newItems);
  };

  const handleUpdate = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(fieldId, newItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={`space-y-3 ${isMissing ? "rounded-md border-2 border-red-500 bg-red-50/50 dark:bg-red-950/20 p-3" : ""}`}>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 rounded-md border p-2 ${
              isMissing ? "border-red-300 bg-red-50/30" : "border-zinc-200 bg-zinc-50"
            }`}
          >
            <GripVertical className="h-4 w-4 text-zinc-400 cursor-grab" />
            <span className="w-6 text-center text-sm font-medium text-zinc-500">
              •
            </span>
            {readOnly ? (
              <span className="flex-1 text-sm text-zinc-700">{item}</span>
            ) : (
              <Input
                type="text"
                value={item}
                onChange={(e) => handleUpdate(index, e.target.value)}
                className="flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0"
              />
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`flex-1 ${isMissing ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAdd}
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

