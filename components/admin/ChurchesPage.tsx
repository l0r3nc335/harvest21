"use client";
import { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { CreateChurchForm } from "@/components/admin/CreateChurchForm";
import { useRouter } from "next/navigation";
import { deleteChurch, toggleChurchStatus } from "@/app/admin/churches/actions";
import toast from "react-hot-toast";
import type { ChurchListItem } from "@/types/church";

type ChurchesPageClientProps = {
  initialChurches?: ChurchListItem[];
  isInitialLoading?: boolean;
};

export function ChurchesPageClient({ initialChurches = [], isInitialLoading = false }: ChurchesPageClientProps) {
  const router = useRouter();
  const [churches, setChurches] = useState<ChurchListItem[]>(initialChurches);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isLoading = isInitialLoading;

  useEffect(() => {
    setChurches(initialChurches);
  }, [initialChurches]);

  const handleManagePage = (id: string) => {
    router.push(`/admin/churches/${id}`);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteChurch(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete church");
    }
  };

  const handleDisable = async (id: string) => {
    const church = churches.find((c) => c.id === id);
    const isDisabled = church?.accountStatus !== "Inactive";
    
    const result = await toggleChurchStatus(id, isDisabled);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update church status");
    }
  };

  const handleCreateSuccess = async (result: { church: { id: number; name: string; city?: string | null; country?: string | null }; user?: { status?: string; last_activity?: string | null } | null }) => {
    // Transform the created church to match Church type format
    const location = [result.church.city, result.church.country].filter(Boolean).join(", ") || "N/A";
    
    // Format last activity
    let lastActivity = "N/A";
    if (result.user?.last_activity) {
      const date = new Date(result.user.last_activity);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        lastActivity = "Today";
      } else if (diffDays === 1) {
        lastActivity = "Yesterday";
      } else if (diffDays < 7) {
        lastActivity = `${diffDays} days ago`;
      } else {
        lastActivity = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    }

    let accountStatus: ChurchListItem["accountStatus"] = "Active";
    if (result.user?.status === "Inactive") {
      accountStatus = "Inactive";
    } else if (result.user?.status === "Pending" || result.user?.status === "Pending Invite") {
      accountStatus = "Pending";
    }

    const newChurch: ChurchListItem = {
      id: result.church.id.toString(),
      name: result.church.name || "",
      location: location,
      accountStatus: accountStatus,
      lastActivity: lastActivity,
      isManagedByHarvest21: result.user == null,
    };

    // Add the new church to the list without refetching
    setChurches((prev) => [newChurch, ...prev]);
  };

  return (
    <>
      <DataTable
        title="Churches"
        data={churches}
        entityName="churches"
        onCreateNew={() => setIsFormOpen(true)}
        onManagePage={handleManagePage}
        onDelete={handleDelete}
        onDisable={handleDisable}
        deleteMessage="Are you sure you want to delete this church? This will also delete all related data including missionaries associated with this church."
        isLoading={isLoading}
        extraColumns={[
          {
            header: "Managed by Harvest21",
            cell: (item) => (item as ChurchListItem).isManagedByHarvest21 ? "Yes" : "No",
          },
        ]}
      />

      {/* Create Church Form Panel */}
      <CreateChurchForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateSuccess}
      />
    </>
  );
}
