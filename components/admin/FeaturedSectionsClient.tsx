"use client";

import { useState } from "react";
import { SectionList } from "./featured-sections/SectionList";
import { SectionForm } from "./featured-sections/SectionForm";
import { fetchSectionById } from "@/app/admin/featured-sections/fetchActions";
import type { HomepageFeaturedSection, FeaturedProfileCard } from "@/types/homepage";

type View = "list" | "create" | "edit";

interface FeaturedSectionsClientProps {
  sections: HomepageFeaturedSection[];
}

export function FeaturedSectionsClient({ sections: initialSections }: FeaturedSectionsClientProps) {
  const [view, setView] = useState<View>("list");
  const [sections, setSections] = useState<HomepageFeaturedSection[]>(initialSections);
  const [editingSection, setEditingSection] = useState<HomepageFeaturedSection | null>(null);
  const [editingProfiles, setEditingProfiles] = useState<FeaturedProfileCard[]>([]);

  const handleEdit = async (section: HomepageFeaturedSection) => {
    const result = await fetchSectionById(section.id);
    setEditingSection(section);
    setEditingProfiles(result.success && result.data ? result.data.profiles : []);
    setView("edit");
  };

  const handleSuccess = () => {
    setView("list");
    setEditingSection(null);
    setEditingProfiles([]);
    window.location.reload();
  };

  const handleCancel = () => {
    setView("list");
    setEditingSection(null);
    setEditingProfiles([]);
  };

  return (
    <div className="h-full">
      {view === "list" && (
        <SectionList
          sections={sections}
          onEdit={handleEdit}
          onCreate={() => setView("create")}
          onSectionsChange={setSections}
        />
      )}

      {view === "create" && (
        <SectionForm onSuccess={handleSuccess} onCancel={handleCancel} />
      )}

      {view === "edit" && editingSection && (
        <SectionForm
          section={editingSection}
          initialProfiles={editingProfiles}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
