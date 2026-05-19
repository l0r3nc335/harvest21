"use client";

import { useState } from "react";
import { Settings, Users } from "lucide-react";
import { createSection, updateSection } from "@/app/admin/featured-sections/actions";
import { fetchSectionById } from "@/app/admin/featured-sections/fetchActions";
import { ProfileSearch } from "./ProfileSearch";
import { SectionProfileList } from "./SectionProfileList";
import type { HomepageFeaturedSection, FeaturedProfileCard } from "@/types/homepage";
import toast from "react-hot-toast";

type Tab = "details" | "profiles";

interface SectionFormProps {
  section?: HomepageFeaturedSection;
  initialProfiles?: FeaturedProfileCard[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function SectionForm({ section, initialProfiles = [], onSuccess, onCancel }: SectionFormProps) {
  const isEdit = !!section;

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [title, setTitle] = useState(section?.title ?? "");
  const [description, setDescription] = useState(section?.description ?? "");
  const [isActive, setIsActive] = useState(section?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<FeaturedProfileCard[]>(initialProfiles);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const result = isEdit
      ? await updateSection(section.id, { title: title.trim(), description: description.trim() || null, is_active: isActive })
      : await createSection({ title: title.trim(), description: description.trim() || undefined, is_active: isActive });

    if (result.success) {
      toast.success(isEdit ? "Section updated" : "Section created");
      onSuccess();
    } else {
      toast.error(result.error ?? "Failed to save section");
    }
    setIsSubmitting(false);
  };

  const handleProfileAdded = async (profile: FeaturedProfileCard) => {
    setProfiles((prev) => [...prev, profile]);
    if (section) {
      const refreshed = await fetchSectionById(section.id);
      if (refreshed.success && refreshed.data) {
        setProfiles(refreshed.data.profiles);
      }
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; editOnly?: boolean }[] = [
    { id: "details", label: "Section Details", icon: <Settings className="h-4 w-4" /> },
    { id: "profiles", label: "Profiles", icon: <Users className="h-4 w-4" />, editOnly: true },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">
          {isEdit ? section.title : "Create Section"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          ← Back to list
        </button>
      </div>

      {isEdit && (
        <div className="mb-6 flex gap-1 border-b border-zinc-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-[#D3AF37] text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "profiles" && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                  {profiles.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {(activeTab === "details" || !isEdit) && (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Featured Missionaries"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Description <span className="text-zinc-400 text-xs">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short description shown below the section title..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${
                isActive ? "bg-[#D3AF37]" : "bg-zinc-300"
              }`}
              aria-label="Toggle active"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-zinc-700">
              {isActive ? "Active — visible on homepage" : "Inactive — hidden from homepage"}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="cursor-pointer rounded-lg bg-[#D3AF37] px-5 py-2 text-sm font-medium text-black hover:bg-[#c4a030] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Section"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer rounded-lg border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {activeTab === "profiles" && isEdit && section && (
        <div className="max-w-2xl">
          <p className="text-sm text-zinc-500 mb-4">
            Search and add missionaries, churches, or agencies. Drag rows to reorder.
          </p>

          <ProfileSearch
            sectionId={section.id}
            existingProfileIds={profiles.map((p) => p.profile_id)}
            onAdded={handleProfileAdded}
          />

          <div className="mt-4">
            <SectionProfileList
              sectionId={section.id}
              profiles={profiles}
              onProfilesChange={setProfiles}
            />
          </div>
        </div>
      )}
    </div>
  );
}
