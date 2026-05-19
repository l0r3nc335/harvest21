"use client";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { deleteUser, toggleUserStatus } from "@/app/admin/users/actions";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import type { User, UserRole } from "@/types/user";

const ITEMS_PER_PAGE = 10;

type SortOption = "name-asc" | "name-desc" | "activity" | "role" | "status" | "";
type FilterOption = {
  role?: number;
  status?: User["status"];
};

type UsersPageClientProps = {
  initialUsers: User[];
  userRoles: UserRole[];
  isInitialLoading?: boolean;
};

function UsersPageContent({ initialUsers, userRoles, isInitialLoading = false }: UsersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const isInitialMount = useRef(true);

  // Update users when initialUsers prop changes (after router.refresh())
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);
  
  // Get initial state from URL params
  const initialSort = (searchParams.get("sort") as SortOption) || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialRoleFilter = searchParams.get("role") ? parseInt(searchParams.get("role")!, 10) : undefined;
  const initialStatusFilter = searchParams.get("status") as User["status"] | null;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOption>({
    role: initialRoleFilter,
    status: initialStatusFilter || undefined,
  });

  // Update URL when filters/sort/page change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (sortBy) params.set("sort", sortBy);
    if (currentPage > 1) params.set("page", currentPage.toString());
    if (filters.role !== undefined) params.set("role", filters.role.toString());
    if (filters.status) params.set("status", filters.status);
    
    const queryString = params.toString();
    router.push(`/admin/users${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [sortBy, filters, currentPage, router]);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role_name?.toLowerCase().includes(q)
      );
    }

    // Apply filters
    if (filters.role !== undefined && filters.role !== null) {
      result = result.filter((u) => u.role === filters.role);
    }
    if (filters.status) {
      result = result.filter((u) => u.status === filters.status);
    }

    // Apply sorting
    if (sortBy === "name-asc") {
      result.sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name}`;
        const nameB = `${b.first_name} ${b.last_name}`;
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === "name-desc") {
      result.sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name}`;
        const nameB = `${b.first_name} ${b.last_name}`;
        return nameB.localeCompare(nameA);
      });
    } else if (sortBy === "activity") {
      result.sort((a, b) => {
        const timeA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
        const timeB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        return timeB - timeA;
      });
    } else if (sortBy === "role") {
      result.sort((a, b) => {
        const roleA = a.role_name || "";
        const roleB = b.role_name || "";
        return roleA.localeCompare(roleB);
      });
    } else if (sortBy === "status") {
      result.sort((a, b) => {
        const statusOrder = ["Active", "Pending Invite", "Inactive"];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        return aIndex - bIndex;
      });
    }

    return result;
  }, [users, sortBy, filters, searchQuery]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedUsers.slice(startIndex, endIndex);
  }, [filteredAndSortedUsers, currentPage]);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null
  ).length;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setCurrentPage(1);
  };

  const handleFilter = (type: keyof FilterOption, value: number | string | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      // Toggle filter: if same value is selected, remove it; otherwise set it
      if (newFilters[type] === value) {
        delete newFilters[type];
      } else {
        if (type === "role") {
          newFilters[type] = value as number;
        } else {
          newFilters[type] = value as User["status"];
        }
      }
      return newFilters;
    });
    setCurrentPage(1); // Reset page when filter changes
  };

  const clearFilters = () => {
    setFilters({});
    setSortBy("");
  };

  const getRoleBadge = (roleName: string) => {
    const roleLower = roleName.toLowerCase();
    if (roleLower.includes("admin") || roleLower.includes("super")) {
      return <Badge variant="success">{roleName}</Badge>;
    } else if (roleLower.includes("content")) {
      return <Badge variant="info">{roleName}</Badge>;
    } else {
      return <Badge variant="default">{roleName}</Badge>;
    }
  };

  const getStatusBadge = (status: User["status"]) => {
    switch (status) {
      case "Active":
        return <Badge variant="success">{status}</Badge>;
      case "Pending Invite":
        return <Badge variant="warning">{status}</Badge>;
      case "Inactive":
        return <Badge variant="default">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatLastActivity = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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

      if (currentPage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteUser(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete user");
    }
  };

  const handleDisable = async (id: string) => {
    const user = users.find((u) => u.id === id);
    const isDisabled = user?.status === "Active";
    
    const result = await toggleUserStatus(id, isDisabled);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update user status");
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Page Header */}
      <div className="mb-4 md:mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Users</h1>

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
              sortBy === "role" ? "Role" :
              sortBy === "status" ? "Status" :
              undefined
            }
          >
            <DropdownItem onClick={() => handleSort("name-asc")}>Name (A-Z)</DropdownItem>
            <DropdownItem onClick={() => handleSort("name-desc")}>Name (Z-A)</DropdownItem>
            <DropdownItem onClick={() => handleSort("activity")}>Last Activity</DropdownItem>
            <DropdownItem onClick={() => handleSort("role")}>Role</DropdownItem>
            <DropdownItem onClick={() => handleSort("status")}>Status</DropdownItem>
            {sortBy && <DropdownItem onClick={() => handleSort("")}>Clear Sort</DropdownItem>}
          </Dropdown>
          
          <Dropdown label="Filters" badge={activeFilterCount} className="w-auto">
            {userRoles.map((role) => (
              <DropdownItem 
                key={role.id} 
                onClick={() => handleFilter("role", role.id)}
                className={filters.role === role.id ? "bg-zinc-100 dark:bg-zinc-800" : ""}
              >
                Role: {role.role}
              </DropdownItem>
            ))}
            <DropdownItem 
              onClick={() => handleFilter("status", "Active")}
              className={filters.status === "Active" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: Active
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "Pending Invite")}
              className={filters.status === "Pending Invite" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: Pending Invite
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "Inactive")}
              className={filters.status === "Inactive" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: Inactive
            </DropdownItem>
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
              onClick={() => console.log("Create New")}
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
            placeholder="Search users by name, email or role..."
            className="w-full pl-10 pr-10 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D3AF37] focus:border-transparent dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />

          {
            searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transform text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )
          }
        </div>
        
      </div>

      {/* Table Container - Mobile Responsive */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-full">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-zinc-200">
            {isInitialLoading ? (
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
            ) : paginatedUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                {searchQuery ? `No users matching "${searchQuery}"` : "No data available"}
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div key={user.id} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar
                        size="sm"
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(`${user.first_name} ${user.last_name}`)}&background=random&color=fff&size=128`}
                        alt={`${user.first_name} ${user.last_name}`}
                        fallback={getInitials(user.first_name, user.last_name)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {user.first_name} {user.last_name}
                        </div>
                        {user.email && (
                          <div className="text-sm text-zinc-500 truncate">{user.email}</div>
                        )}
                      </div>
                    </div>
                        <KebabMenu
                          onDelete={() => handleDelete(user.id)}
                          onDisable={() => handleDisable(user.id)}
                          isDisabled={user.status !== "Active"}
                          deleteMessage="Are you sure you want to delete this user? This will also delete all related data including missionaries, churches, agencies, colleges, and donors associated with this user."
                        />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-2">
                      <div>{getRoleBadge(user.role_name || "Unknown")}</div>
                      <div>{getStatusBadge(user.status)}</div>
                      <div className="text-xs text-zinc-500">{formatLastActivity(user.last_activity)}</div>
                    </div>
                    {user.status === "Pending Invite" && (
                      <Button
                        variant="primary"
                        className="text-xs px-2 py-1"
                        onClick={() => console.log("Invite again", user.id)}
                      >
                        Invite Again
                      </Button>
                    )}
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
                  USER
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  ROLE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  LAST ACTIVITY
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-700">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isInitialLoading ? (
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="h-8 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800 ml-auto"></div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-500">
                    {searchQuery ? `No users matching "${searchQuery}"` : "No data available"}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size="sm"
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(`${user.first_name} ${user.last_name}`)}&background=random&color=fff&size=128`}
                          alt={`${user.first_name} ${user.last_name}`}
                          fallback={getInitials(user.first_name, user.last_name)}
                        />
                        <div>
                          <div className="text-sm font-medium text-zinc-900">
                            {user.first_name} {user.last_name}
                          </div>
                          {user.email && (
                            <div className="text-sm text-zinc-500">{user.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role_name || "Unknown")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {formatLastActivity(user.last_activity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === "Pending Invite" && (
                          <Button
                            variant="primary"
                            className="text-sm px-3 py-1.5"
                            onClick={() => console.log("Invite again", user.id)}
                          >
                            Invite Again
                          </Button>
                        )}
                        <KebabMenu
                          onDelete={() => handleDelete(user.id)}
                          onDisable={() => handleDisable(user.id)}
                          isDisabled={user.status !== "Active"}
                          deleteMessage="Are you sure you want to delete this user? This will also delete all related data including missionaries, churches, agencies, colleges, and donors associated with this user."
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
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedUsers.length)} of{" "}
            {filteredAndSortedUsers.length} users
          </div>
          
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
                    className={`cursor-pointer rounded-md border px-3 py-1 text-sm transition-colors ${
                      currentPage === pageNum
                        ? "bg-[#D3AF37] text-black border-[#D3AF37] font-medium"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersPageLoadingFallback() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-8 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="h-10 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
          <div className="h-10 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="p-8">
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
      </div>
    </div>
  );
}

export function UsersPageClient({ initialUsers, userRoles, isInitialLoading = false }: UsersPageClientProps) {
  return (
    <Suspense fallback={<UsersPageLoadingFallback />}>
      <UsersPageContent initialUsers={initialUsers} userRoles={userRoles} isInitialLoading={isInitialLoading} />
    </Suspense>
  );
}
