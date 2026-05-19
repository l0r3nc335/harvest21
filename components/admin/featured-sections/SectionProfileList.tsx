"use client";

import { useState, useEffect } from "react";
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
import { GripVertical, X } from "lucide-react";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { removeProfile, reorderProfiles } from "@/app/admin/featured-sections/actions";
import type { FeaturedProfileCard } from "@/types/homepage";
import toast from "react-hot-toast";

interface SortableProfileRowProps {
  profile: FeaturedProfileCard;
  onRemove: (id: number) => void;
  isRemoving: boolean;
}

function SortableProfileRow({ profile, onRemove, isRemoving }: SortableProfileRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: profile.section_profile_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeBadgeClass =
    profile.profile_type === "missionary"
      ? "bg-yellow-500/20 text-yellow-600"
      : profile.profile_type === "church"
      ? "bg-blue-500/20 text-blue-600"
      : "bg-green-500/20 text-green-600";

  const typeLabel =
    profile.profile_type === "missionary"
      ? "Missionary"
      : profile.profile_type === "church"
      ? "Church"
      : "Agency";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-zinc-400 hover:text-zinc-600 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <MissionaryProfileImage
        src={profile.profile_photo_url}
        alt={profile.name}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover shrink-0"
      />

      <span className="flex-1 truncate text-sm font-medium text-zinc-800">{profile.name}</span>

      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}>
        {typeLabel}
      </span>

      <button
        onClick={() => onRemove(profile.section_profile_id)}
        disabled={isRemoving}
        className="shrink-0 cursor-pointer rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        aria-label="Remove profile"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface SectionProfileListProps {
  sectionId: number;
  profiles: FeaturedProfileCard[];
  onProfilesChange: (profiles: FeaturedProfileCard[]) => void;
}

export function SectionProfileList({ sectionId: _sectionId, profiles, onProfilesChange }: SectionProfileListProps) {
  const [items, setItems] = useState<FeaturedProfileCard[]>(profiles);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    setItems(profiles);
  }, [profiles]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((p) => p.section_profile_id === active.id);
    const newIndex = items.findIndex((p) => p.section_profile_id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    setItems(reordered);
    onProfilesChange(reordered);

    const result = await reorderProfiles(reordered.map((p) => p.section_profile_id));
    if (!result.success) {
      toast.error(result.error ?? "Failed to reorder profiles");
      setItems(items);
      onProfilesChange(items);
    }
  };

  const handleRemove = async (sectionProfileId: number) => {
    setRemovingId(sectionProfileId);
    const result = await removeProfile(sectionProfileId);
    if (result.success) {
      const updated = items.filter((p) => p.section_profile_id !== sectionProfileId);
      setItems(updated);
      onProfilesChange(updated);
      toast.success("Profile removed");
    } else {
      toast.error(result.error ?? "Failed to remove profile");
    }
    setRemovingId(null);
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-400 py-4 text-center">
        No profiles added yet. Use the search above to add profiles.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((p) => p.section_profile_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.map((profile) => (
            <SortableProfileRow
              key={profile.section_profile_id}
              profile={profile}
              onRemove={handleRemove}
              isRemoving={removingId === profile.section_profile_id}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
