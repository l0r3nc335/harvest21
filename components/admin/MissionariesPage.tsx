"use client";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { deleteMissionary, toggleMissionaryStatus, resendActivationEmail } from "@/app/admin/missionaries/actions";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { CreateMissionaryForm } from "@/components/admin/CreateMissionaryForm";
import type { Missionary } from "@/types/missionary";
import { truncateName } from "@/lib/utils";

type SortOption = "name-asc" | "name-desc" | "activity" | "status" | "";
type FilterOption = {
  missionStatus?: Missionary["missionStatus"];
  accountStatus?: Missionary["accountStatus"];
  location?: string;
};

type MissionariesPageClientProps = {
  initialMissionaries?: Missionary[];
  isInitialLoading?: boolean;
};

const ITEMS_PER_PAGE = 10;

export function MissionariesPageClient({ initialMissionaries = [], isInitialLoading = false }: MissionariesPageClientProps) {
  const router = useRouter();
  const [localMissionaries, setLocalMissionaries] = useState<Missionary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("");
  const [filters, setFilters] = useState<FilterOption>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const missionaries = useMemo(() => {
    if (localMissionaries.length > 0) {
      const initialIds = new Set(initialMissionaries.map(m => m.id));
      const newLocal = localMissionaries.filter(m => !initialIds.has(m.id));
      return [...newLocal, ...initialMissionaries];
    }
    return initialMissionaries;
  }, [initialMissionaries, localMissionaries]);
  
  const isLoading = isInitialLoading;

  // Get unique locations for filtering
  const uniqueLocations = useMemo(() => {
    const locations = new Set(missionaries.map((m) => m.location));
    return Array.from(locations).sort();
  }, [missionaries]);

  // Filter and sort missionaries
  const filteredAndSortedMissionaries = useMemo(() => {
    let result = [...missionaries];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((m) => 
        m.name.toLowerCase().includes(query) ||
        m.location.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.missionStatus) {
      result = result.filter((m) => m.missionStatus === filters.missionStatus);
    }
    if (filters.accountStatus) {
      result = result.filter((m) => m.accountStatus === filters.accountStatus);
    }
    if (filters.location) {
      result = result.filter((m) => m.location === filters.location);
    }

    // Apply sorting
    if (sortBy === "name-asc") {
      result.sort((a, b) => {
        const aLastName = a.lastName || a.name.split(" ").pop() || a.name;
        const bLastName = b.lastName || b.name.split(" ").pop() || b.name;
        return aLastName.localeCompare(bLastName);
      });
    } else if (sortBy === "name-desc") {
      result.sort((a, b) => {
        const aLastName = a.lastName || a.name.split(" ").pop() || a.name;
        const bLastName = b.lastName || b.name.split(" ").pop() || b.name;
        return bLastName.localeCompare(aLastName);
      });
    } else if (sortBy === "activity") {
      // Parse date strings (simple comparison - in real app, use proper date parsing)
      result.sort((a, b) => {
        // This is a simple comparison - you'd want proper date parsing in production
        return b.lastActivity.localeCompare(a.lastActivity);
      });
    } else if (sortBy === "status") {
      result.sort((a, b) => {
        const statusOrder = ["Active", "New", "Pending Invite", "Review", "Inactive"];
        const aIndex = statusOrder.indexOf(a.accountStatus) !== -1 
          ? statusOrder.indexOf(a.accountStatus) 
          : 999;
        const bIndex = statusOrder.indexOf(b.accountStatus) !== -1 
          ? statusOrder.indexOf(b.accountStatus) 
          : 999;
        return aIndex - bIndex;
      });
    }

    return result;
  }, [missionaries, sortBy, filters, searchQuery]);

  const totalPages = Math.ceil(filteredAndSortedMissionaries.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedData = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedMissionaries.slice(startIndex, endIndex);
  }, [filteredAndSortedMissionaries, safePage]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setCurrentPage(1);
  };

  const handleFilter = (type: keyof FilterOption, value: string | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      // Toggle filter: if same value is selected, remove it; otherwise set it
      if (newFilters[type] === value) {
        delete newFilters[type];
      } else {
        if (type === "missionStatus") {
          newFilters[type] = value as Missionary["missionStatus"];
        } else if (type === "accountStatus") {
          newFilters[type] = value as Missionary["accountStatus"];
        } else {
          newFilters[type] = value;
        }
      }
      return newFilters;
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSortBy("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (safePage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safePage < totalPages - 2) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteMissionary(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete missionary");
    }
  };

  const handleDisable = async (id: string) => {
    const result = await toggleMissionaryStatus(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update missionary status");
    }
  };

  const handleSendInvite = async (id: string) => {
    const loadingToast = toast.loading("Sending activation email...");
    
    try {
      const result = await resendActivationEmail(id);
      toast.dismiss(loadingToast);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message || "Failed to send activation email");
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("An error occurred while sending the email");
    }
  };

  const handleCreateSuccess = async (result: { missionary: { id: number; first_name: string; last_name: string; destination_country?: string | null; mission_status?: string; is_managed_by_harvest21?: boolean }; user?: { status?: string; last_activity?: string | null } | null }) => {
    // Transform the created missionary to match Missionary type format
    const location = result.missionary.destination_country || "N/A";
    
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

    let accountStatus: Missionary["accountStatus"] = "Active";
    if (!result.user) {
      accountStatus = "New";
    } else if (result.user.status === "Inactive") {
      accountStatus = "Inactive";
    } else if (result.user.status === "Pending" || result.user.status === "Pending Invite") {
      accountStatus = "Pending Invite";
    } else if (result.user.status === "Active") {
      accountStatus = "Active";
    }

    // Map mission_status to Missionary type
    let missionStatus: Missionary["missionStatus"] = "On-field";
    if (result.missionary.mission_status === "On-Field") {
      missionStatus = "On-field";
    } else if (result.missionary.mission_status === "Furlough") {
      missionStatus = "Off-field";
    } else if (result.missionary.mission_status === "Deputation") {
      missionStatus = "Pending";
    }

    const fullName = `${result.missionary.first_name || ""} ${result.missionary.last_name || ""}`.trim() || "Unknown";

    const newMissionary: Missionary = {
      id: result.missionary.id.toString(),
      name: fullName,
      location: location,
      missionStatus: missionStatus,
      accountStatus: accountStatus,
      lastActivity: lastActivity,
      isManagedByHarvest21: (result.missionary as { is_managed_by_harvest21?: boolean }).is_managed_by_harvest21 ?? result.user == null,
    };

    // Add the new missionary to the list without refetching
    setLocalMissionaries((prev) => [newMissionary, ...prev]);
  };

  const getMissionStatusBadge = (status: Missionary["missionStatus"]) => {
    switch (status) {
      case "On-field":
        return <Badge variant="success">{status}</Badge>;
      case "Off-field":
        return <Badge variant="default">{status}</Badge>;
      case "Pending":
        return <Badge variant="warning">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getAccountStatusBadge = (status: Missionary["accountStatus"], hasReview?: boolean) => {
    switch (status) {
      case "Active":
        return (
          <>
            <Badge variant="success">{status}</Badge>
            {hasReview && <Badge variant="danger" className="ml-2">Review</Badge>}
          </>
        );
      case "Pending Invite":
        return <Badge variant="warning">{status}</Badge>;
      case "New":
        return <Badge variant="info">{status}</Badge>;
      case "Inactive":
        return <Badge variant="default">{status}</Badge>;
      case "Review":
        return <Badge variant="danger">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getActionButton = (missionary: Missionary) => {
    switch (missionary.accountStatus) {
      case "Pending Invite":
        return (
          <Button
            variant="secondary"
            className="text-sm px-3 py-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
            onClick={() => handleSendInvite(missionary.id)}
          >
            Invite Again
          </Button>
        );
      case "New":
        return (
          <Button
            variant="primary"
            className="text-sm px-3 py-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md hover:opacity-90"
            onClick={() => handleSendInvite(missionary.id)}
          >
            Send Invite
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Page Header */}
      <div className="mb-4 md:mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Missionaries</h1>
          
          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex flex-row gap-2 md:gap-3 w-full sm:w-auto items-start">
          <Dropdown 
            label="Sort By" 
            className="w-auto"
            selectedValue={
              sortBy === "name-asc" ? "Name (A-Z)" :
              sortBy === "name-desc" ? "Name (Z-A)" :
              sortBy === "activity" ? "Last Activity" :
              sortBy === "status" ? "Status" :
              undefined
            }
          >
            <DropdownItem onClick={() => handleSort("name-asc")}>Name (A-Z)</DropdownItem>
            <DropdownItem onClick={() => handleSort("name-desc")}>Name (Z-A)</DropdownItem>
            <DropdownItem onClick={() => handleSort("activity")}>Last Activity</DropdownItem>
            <DropdownItem onClick={() => handleSort("status")}>Status</DropdownItem>
            {sortBy && <DropdownItem onClick={() => handleSort("")}>Clear Sort</DropdownItem>}
          </Dropdown>
          
          <Dropdown label="Filters" badge={activeFilterCount} className="w-auto">
            <DropdownItem onClick={() => handleFilter("missionStatus", "On-field")}>
              Mission Status: On-field
            </DropdownItem>
            <DropdownItem onClick={() => handleFilter("missionStatus", "Off-field")}>
              Mission Status: Off-field
            </DropdownItem>
            <DropdownItem onClick={() => handleFilter("missionStatus", "Pending")}>
              Mission Status: Pending
            </DropdownItem>
            <DropdownItem onClick={() => handleFilter("accountStatus", "Active")}>
              Account Status: Active
            </DropdownItem>
            <DropdownItem onClick={() => handleFilter("accountStatus", "Pending Invite")}>
              Account Status: Pending Invite
            </DropdownItem>
            <DropdownItem onClick={() => handleFilter("accountStatus", "New")}>
              Account Status: New
            </DropdownItem>
            <DropdownItem onClick={() => handleFilter("accountStatus", "Inactive")}>
              Account Status: Inactive
            </DropdownItem>
            {uniqueLocations.map((location) => (
              <DropdownItem key={location} onClick={() => handleFilter("location", location)}>
                Location: {location}
              </DropdownItem>
            ))}
            {activeFilterCount > 0 && (
              <DropdownItem onClick={clearFilters}>
                Clear All Filters
              </DropdownItem>
            )}
          </Dropdown>
            </div>
            <Button
              variant="primary"
              className="text-sm px-3 py-2 w-full sm:w-auto"
              onClick={() => setIsFormOpen(true)}
            >
              + Create New
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search missionaries by name or location..."
            className="w-full pl-10 pr-10 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D3AF37] focus:border-transparent dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transform text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Table Container - Mobile Responsive */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-full">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-zinc-200">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-zinc-200 animate-pulse dark:bg-zinc-800"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                        <div className="h-3 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                      </div>
                      <div className="h-6 w-20 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No data available
              </div>
            ) : (
              paginatedData.map((missionary) => (
                <div key={missionary.id} className="p-4 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar
                        size="sm"
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(missionary.name)}&background=random&color=fff&size=128`}
                        alt={missionary.name}
                        fallback={missionary.name.charAt(0)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-900 truncate" title={missionary.name}>
                          {truncateName(missionary.name)}
                        </div>
                        <div className="text-sm text-zinc-500">{missionary.location}</div>
                      </div>
                    </div>
                    <KebabMenu
                      onDelete={() => handleDelete(missionary.id)}
                      onDisable={() => handleDisable(missionary.id)}
                      isDisabled={missionary.accountStatus !== "Active"}
                      deleteMessage="Are you sure you want to delete this missionary? This will also delete all related data."
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getMissionStatusBadge(missionary.missionStatus)}
                        {getAccountStatusBadge(missionary.accountStatus, missionary.hasReview)}
                      </div>
                      <div className="text-xs text-zinc-500">{missionary.lastActivity}</div>
                      <div className="text-xs text-zinc-600">
                        Managed by Harvest21: {missionary.isManagedByHarvest21 ? "Yes" : "No"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getActionButton(missionary)}
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1 transition-all duration-200 hover:scale-105 hover:shadow-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        onClick={() => router.push(`/admin/missionaries/${missionary.id}`)}
                      >
                        Manage Page
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <table className="hidden md:table w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  NAME
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  MISSION STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  ACCOUNT STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  PAYOUT STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  LAST ACTIVITY
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  MANAGED BY HARVEST21
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-700">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                <>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-zinc-200 animate-pulse dark:bg-zinc-800"></div>
                          <div className="space-y-2">
                            <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                            <div className="h-3 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 w-20 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-12 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="h-8 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800 ml-auto"></div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedData.map((missionary) => (
                  <tr key={missionary.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          size="sm"
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(missionary.name)}&background=random&color=fff&size=128`}
                          alt={missionary.name}
                          fallback={missionary.name.charAt(0)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-900 truncate" title={missionary.name}>
                            {truncateName(missionary.name)}
                          </div>
                          <div className="text-sm text-zinc-500 truncate">{missionary.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMissionStatusBadge(missionary.missionStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getAccountStatusBadge(missionary.accountStatus, missionary.hasReview)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {missionary.payoutStatus === "enabled" ? (
                        <Badge variant="success">Enabled</Badge>
                      ) : missionary.payoutStatus === "pending" || missionary.payoutStatus === "restricted" ? (
                        <Badge variant="warning">{missionary.payoutStatus === "pending" ? "Pending" : "Restricted"}</Badge>
                      ) : missionary.payoutStatus === "incomplete" ? (
                        <Badge variant="danger">Incomplete</Badge>
                      ) : (
                        <span className="text-zinc-400 text-xs">Not Started</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {missionary.lastActivity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">
                      {missionary.isManagedByHarvest21 ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {getActionButton(missionary)}
                        <Button
                          variant="secondary"
                          className="text-sm px-3 py-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          onClick={() => router.push(`/admin/missionaries/${missionary.id}`)}
                        >
                          Manage Page
                        </Button>
                        <KebabMenu
                          onDelete={() => handleDelete(missionary.id)}
                          onDisable={() => handleDisable(missionary.id)}
                          isDisabled={missionary.accountStatus !== "Active"}
                          deleteMessage="Are you sure you want to delete this missionary? This will also delete all related data."
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 md:mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-zinc-600">
            Showing {(safePage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(safePage * ITEMS_PER_PAGE, filteredAndSortedMissionaries.length)} of{" "}
            {filteredAndSortedMissionaries.length} missionaries
          </div>
          
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage === 1}
              className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 transition-all duration-200 hover:bg-zinc-100 hover:scale-105 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => {
                if (page === "...") {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-3 py-1 text-zinc-500"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = page as number;
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`cursor-pointer rounded-md border px-3 py-1 text-sm transition-all duration-200 ${
                      safePage === pageNum
                        ? "bg-brand-yellow text-black border-brand-yellow font-medium"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:scale-105 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage === totalPages}
              className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 transition-all duration-200 hover:bg-zinc-100 hover:scale-105 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Missionary Form Panel */}
      <CreateMissionaryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateSuccess}
      />
    </div>
  );
}
