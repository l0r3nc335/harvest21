"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Plus } from "lucide-react";
import { deleteSection, reorderSections, updateSection } from "@/app/admin/featured-sections/actions";
import type { HomepageFeaturedSection } from "@/types/homepage";
import toast from "react-hot-toast";

interface SortableSectionRowProps {
  section: HomepageFeaturedSection;
  onEdit: (section: HomepageFeaturedSection) => void;
  onDeleted: (id: number) => void;
  onToggleActive: (id: number, current: boolean) => void;
  isTogglingActive: boolean;
}

function SortableSectionRow({
  section,
  onEdit,
  onDeleted,
  onToggleActive,
  isTogglingActive,
}: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteSection(section.id);
    if (result.success) {
      toast.success("Section deleted");
      onDeleted(section.id);
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
    setIsDeleting(false);
    setConfirmDelete(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab text-zinc-400 hover:text-zinc-600 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-zinc-900 truncate">{section.title}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              section.is_active
                ? "bg-green-100 text-green-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {section.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        {section.description && (
          <p className="mt-0.5 text-sm text-zinc-500 truncate">{section.description}</p>
        )}

        {confirmDelete && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-red-600 font-medium">Delete this section?</span>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="cursor-pointer rounded px-3 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="cursor-pointer rounded px-3 py-1 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onToggleActive(section.id, section.is_active)}
          disabled={isTogglingActive}
          className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            section.is_active ? "bg-[#D3AF37]" : "bg-zinc-300"
          }`}
          aria-label="Toggle active"
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              section.is_active ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>

        <button
          onClick={() => onEdit(section)}
          className="cursor-pointer rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          aria-label="Edit section"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          className="cursor-pointer rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          aria-label="Delete section"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface SectionListProps {
  sections: HomepageFeaturedSection[];
  onEdit: (section: HomepageFeaturedSection) => void;
  onCreate: () => void;
  onSectionsChange: (sections: HomepageFeaturedSection[]) => void;
}

export function SectionList({ sections, onEdit, onCreate, onSectionsChange }: SectionListProps) {
  const [items, setItems] = useState<HomepageFeaturedSection[]>(sections);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    setItems(reordered);
    onSectionsChange(reordered);

    const result = await reorderSections(reordered.map((s) => s.id));
    if (!result.success) {
      toast.error(result.error ?? "Failed to reorder");
      setItems(items);
      onSectionsChange(items);
    }
  };

  const handleDeleted = (id: number) => {
    const updated = items.filter((s) => s.id !== id);
    setItems(updated);
    onSectionsChange(updated);
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    setTogglingId(id);
    const result = await updateSection(id, { is_active: !current });
    if (result.success) {
      const updated = items.map((s) =>
        s.id === id ? { ...s, is_active: !current } : s
      );
      setItems(updated);
      onSectionsChange(updated);
      toast.success(!current ? "Section activated" : "Section deactivated");
    } else {
      toast.error(result.error ?? "Failed to update");
    }
    setTogglingId(null);
  };

  const atLimit = items.length >= 3;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Featured Sections</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Up to 3 custom sections appear on the homepage between Following and Continent rows.
          </p>
        </div>

        <div className="relative group">
          <button
            onClick={onCreate}
            disabled={atLimit}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#D3AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#c4a030] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Section
          </button>
          {atLimit && (
            <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block w-52 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-md">
              Maximum of 3 sections allowed. Delete a section to create a new one.
            </div>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border-2 border-dashed border-zinc-200">
          <p className="text-zinc-500 text-sm mb-3">No featured sections yet.</p>
          <button
            onClick={onCreate}
            className="cursor-pointer rounded-lg bg-[#D3AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#c4a030] transition-colors"
          >
            Create your first section
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((section) => (
                <SortableSectionRow
                  key={section.id}
                  section={section}
                  onEdit={onEdit}
                  onDeleted={handleDeleted}
                  onToggleActive={handleToggleActive}
                  isTogglingActive={togglingId === section.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
