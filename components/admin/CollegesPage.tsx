"use client";
import { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { CreateCollegeForm } from "@/components/admin/CreateCollegeForm";
import { useRouter } from "next/navigation";
import { deleteCollege, toggleCollegeStatus } from "@/app/admin/colleges/actions";
import toast from "react-hot-toast";
import type { College } from "@/types/college";

type CollegesPageClientProps = {
  initialColleges?: College[];
  isInitialLoading?: boolean;
};

export function CollegesPageClient({ initialColleges = [], isInitialLoading = false }: CollegesPageClientProps) {
  const router = useRouter();
  const [colleges, setColleges] = useState<College[]>(initialColleges);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isLoading = isInitialLoading;

  useEffect(() => {
    setColleges(initialColleges);
  }, [initialColleges]);

  const handleManagePage = (id: string) => {
    router.push(`/admin/colleges/${id}`);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCollege(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete college");
    }
  };

  const handleDisable = async (id: string) => {
    const college = colleges.find((c) => c.id === id);
    const isDisabled = college?.accountStatus !== "Inactive";
    
    const result = await toggleCollegeStatus(id, isDisabled);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update college status");
    }
  };

  const handleCreateSuccess = async (result: { college: { id: number; name: string; city?: string | null; country?: string | null }; user: { status?: string; last_activity?: string | null } }) => {
    // Transform the created college to match College type format
    const location = [result.college.city, result.college.country].filter(Boolean).join(", ") || "N/A";
    
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

    // Map user status to accountStatus
    let accountStatus: College["accountStatus"] = "Active";
    if (result.user?.status === "Inactive") {
      accountStatus = "Inactive";
    } else if (result.user?.status === "Pending" || result.user?.status === "Pending Invite") {
      accountStatus = "Pending";
    }

    const newCollege: College = {
      id: result.college.id.toString(),
      name: result.college.name || "",
      location: location,
      accountStatus: accountStatus,
      lastActivity: lastActivity,
    };

    // Add the new college to the list without refetching
    setColleges((prev) => [newCollege, ...prev]);
  };

  return (
    <>
      <DataTable
        title="Colleges"
        data={colleges}
        entityName="colleges"
        onCreateNew={() => setIsFormOpen(true)}
        onManagePage={handleManagePage}
        onDelete={handleDelete}
        onDisable={handleDisable}
        deleteMessage="Are you sure you want to delete this college? This will also delete all related data including missionaries associated with this college."
        isLoading={isLoading}
      />

      {/* Create College Form Panel */}
      <CreateCollegeForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateSuccess}
      />
    </>
  );
}
