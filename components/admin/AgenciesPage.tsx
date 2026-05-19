"use client";
import { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { CreateAgencyForm } from "@/components/admin/CreateAgencyForm";
import { useRouter } from "next/navigation";
import { deleteAgency, toggleAgencyStatus } from "@/app/admin/agencies/actions";
import toast from "react-hot-toast";
import type { AgencyListItem } from "@/types/agency";

type AgenciesPageClientProps = {
  initialAgencies?: AgencyListItem[];
  isInitialLoading?: boolean;
};

export function AgenciesPageClient({ initialAgencies = [], isInitialLoading = false }: AgenciesPageClientProps) {
  const router = useRouter();
  const [agencies, setAgencies] = useState<AgencyListItem[]>(initialAgencies);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isLoading = isInitialLoading;

  useEffect(() => {
    setAgencies(initialAgencies);
  }, [initialAgencies]);

  const handleManagePage = (id: string) => {
    router.push(`/admin/agencies/${id}`);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAgency(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete agency");
    }
  };

  const handleDisable = async (id: string) => {
    const agency = agencies.find((a) => a.id === id);
    const isDisabled = agency?.accountStatus !== "Inactive";
    
    const result = await toggleAgencyStatus(id, isDisabled);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update agency status");
    }
  };

  const handleCreateSuccess = async (result: { agency: { id: number; name: string; city?: string | null; country?: string | null }; user?: { status?: string; last_activity?: string | null } | null }) => {
    // Transform the created agency to match Agency type format
    const location = [result.agency.city, result.agency.country].filter(Boolean).join(", ") || "N/A";
    
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

    let accountStatus: AgencyListItem["accountStatus"] = "Active";
    if (result.user?.status === "Inactive") {
      accountStatus = "Inactive";
    } else if (result.user?.status === "Pending" || result.user?.status === "Pending Invite") {
      accountStatus = "Pending";
    }

    const newAgency: AgencyListItem = {
      id: result.agency.id.toString(),
      name: result.agency.name || "",
      location: location,
      accountStatus: accountStatus,
      lastActivity: lastActivity,
      isManagedByHarvest21: result.user == null,
    };

    // Add the new agency to the list without refetching
    setAgencies((prev) => [newAgency, ...prev]);
  };

  return (
    <>
      <DataTable
        title="Agencies"
        data={agencies}
        entityName="agencies"
        onCreateNew={() => setIsFormOpen(true)}
        onManagePage={handleManagePage}
        onDelete={handleDelete}
        onDisable={handleDisable}
        deleteMessage="Are you sure you want to delete this agency? This will also delete all related data including missionaries associated with this agency."
        isLoading={isLoading}
        extraColumns={[
          {
            header: "Managed by Harvest21",
            cell: (item) => (item as AgencyListItem).isManagedByHarvest21 ? "Yes" : "No",
          },
          {
            header: "Missionaries",
            cell: (item) => (item as AgencyListItem).missionaryCount ?? 0,
          },
        ]}
      />

      {/* Create Agency Form Panel */}
      <CreateAgencyForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateSuccess}
      />
    </>
  );
}
