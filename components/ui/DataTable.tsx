"use client";
import { useState, useMemo, ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { truncateName } from "@/lib/utils";

export type EntityWithStatus = {
  id: string;
  name: string;
  location: string;
  accountStatus: "Active" | "Pending" | "Inactive";
  lastActivity: string;
};

const ITEMS_PER_PAGE = 10;

type SortOption = "name-asc" | "name-desc" | "activity" | "status" | "";
type FilterOption = {
  accountStatus?: "Active" | "Pending" | "Inactive";
  location?: string;
};

type DataTableProps<T extends EntityWithStatus> = {
  title: string;
  data: T[];
  entityName: string; // plural form: "churches", "colleges", "agencies"
  onCreateNew?: () => void;
  onManagePage?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDisable?: (id: string) => void;
  renderActions?: (item: T) => ReactNode;
  deleteMessage?: string;
  isLoading?: boolean; // New prop for loading state
  /** Optional extra column (e.g. "Missionaries" for agencies) */
  extraColumn?: { header: string; cell: (item: T) => ReactNode };
  /** Optional extra columns (e.g. "Managed by Harvest21", "Missionaries") */
  extraColumns?: Array<{ header: string; cell: (item: T) => ReactNode }>;
};

export function DataTable<T extends EntityWithStatus>({
  title,
  data,
  entityName,
  onCreateNew,
  onManagePage,
  onDelete,
  onDisable,
  renderActions,
  deleteMessage,
  isLoading = false,
  extraColumn,
  extraColumns,
}: DataTableProps<T>) {
  const resolvedExtraColumns = extraColumns ?? (extraColumn ? [extraColumn] : []);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("");
  const [filters, setFilters] = useState<FilterOption>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Get unique locations for filtering
  const uniqueLocations = useMemo(() => {
    const locations = new Set(data.map((item) => item.location));
    return Array.from(locations).sort();
  }, [data]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((item) => 
        item.name.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.accountStatus) {
      result = result.filter((item) => item.accountStatus === filters.accountStatus);
    }
    if (filters.location) {
      result = result.filter((item) => item.location === filters.location);
    }

    // Apply sorting
    if (sortBy === "name-asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "activity") {
      result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    } else if (sortBy === "status") {
      result.sort((a, b) => {
        const statusOrder = ["Active", "Pending", "Inactive"];
        const aIndex = statusOrder.indexOf(a.accountStatus);
        const bIndex = statusOrder.indexOf(b.accountStatus);
        return aIndex - bIndex;
      });
    }

    return result;
  }, [data, sortBy, filters, searchQuery]);

  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedData = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, safePage]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setCurrentPage(1);
  };

  const handleFilter = (type: keyof FilterOption, value: string | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (newFilters[type] === value) {
        delete newFilters[type];
      } else {
        if (type === "accountStatus") {
          newFilters[type] = value as "Active" | "Pending" | "Inactive";
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

  const getAccountStatusBadge = (status: "Active" | "Pending" | "Inactive") => {
    switch (status) {
      case "Active":
        return <Badge variant="success">{status}</Badge>;
      case "Pending":
        return <Badge variant="warning">{status}</Badge>;
      case "Inactive":
        return <Badge variant="default">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.trim().length === 0) return "??";
    const words = name.trim().split(" ").filter(w => w.length > 0);
    if (words.length >= 2) {
      const firstInitial = words[0][0] || "";
      const lastInitial = words[words.length - 1][0] || "";
      return (firstInitial + lastInitial).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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

  return (
    <div className="p-4 md:p-6">
      {/* Page Header */}
      <div className="mb-4 md:mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          
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
            <DropdownItem 
              onClick={() => handleFilter("accountStatus", "Active")}
              className={filters.accountStatus === "Active" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Account Status: Active
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("accountStatus", "Pending")}
              className={filters.accountStatus === "Pending" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Account Status: Pending
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("accountStatus", "Inactive")}
              className={filters.accountStatus === "Inactive" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Account Status: Inactive
            </DropdownItem>
            {uniqueLocations.map((location) => (
              <DropdownItem 
                key={location} 
                onClick={() => handleFilter("location", location)}
                className={filters.location === location ? "bg-zinc-100 dark:bg-zinc-800" : ""}
              >
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
          {onCreateNew && (
            <Button
              variant="primary"
              className="text-sm px-3 py-2 w-full sm:w-auto"
              onClick={onCreateNew}
            >
              + Create New
            </Button>
          )}
        </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={`Search ${entityName} by name or location...`}
            className="w-full pl-10 pr-10 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D3AF37] focus:border-transparent dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
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
              paginatedData.map((item) => (
                <div key={item.id} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar
                        size="sm"
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&size=128`}
                        alt={item.name}
                        fallback={getInitials(item.name)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-900 truncate" title={item.name}>
                          {truncateName(item.name)}
                        </div>
                        <div className="text-sm text-zinc-500">{item.location}</div>
                        {resolvedExtraColumns.length > 0 && (
                          <div className="text-xs text-zinc-600 mt-0.5 space-y-0.5">
                            {resolvedExtraColumns.map((col) => (
                              <div key={col.header}>{col.header}: {col.cell(item)}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {(onDelete || onDisable) && (
                      <KebabMenu
                        onDelete={() => onDelete?.(item.id)}
                        onDisable={onDisable ? () => onDisable(item.id) : undefined}
                        isDisabled={item.accountStatus === "Inactive"}
                        deleteMessage={deleteMessage}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-2">
                      <div>{getAccountStatusBadge(item.accountStatus)}</div>
                      <div className="text-xs text-zinc-500">{item.lastActivity}</div>
                    </div>
                    {renderActions ? (
                      renderActions(item)
                    ) : onManagePage ? (
                      <Button
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        onClick={() => onManagePage(item.id)}
                      >
                        Manage Page
                      </Button>
                    ) : null}
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
                  ACCOUNT STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  LAST ACTIVITY
                </th>
                {resolvedExtraColumns.map((col) => (
                  <th key={col.header} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                    {col.header}
                  </th>
                ))}
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
                        <div className="h-4 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="h-8 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800 ml-auto"></div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={4 + resolvedExtraColumns.length} className="px-6 py-8 text-center text-sm text-zinc-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          size="sm"
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&size=128`}
                          alt={item.name}
                          fallback={getInitials(item.name)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-900 truncate" title={item.name}>
                            {truncateName(item.name)}
                          </div>
                          <div className="text-sm text-zinc-500 truncate">{item.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getAccountStatusBadge(item.accountStatus)}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {item.lastActivity}
                    </td>
                    {resolvedExtraColumns.map((col) => (
                      <td key={col.header} className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">
                        {col.cell(item)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {renderActions ? (
                          renderActions(item)
                        ) : (
                          <>
                            {onManagePage && (
                              <Button
                                variant="secondary"
                                className="text-sm px-3 py-1.5"
                                onClick={() => onManagePage(item.id)}
                              >
                                Manage Page
                              </Button>
                            )}
                            {(onDelete || onDisable) && (
                              <KebabMenu
                                onDelete={() => onDelete?.(item.id)}
                                onDisable={onDisable ? () => onDisable(item.id) : undefined}
                                isDisabled={item.accountStatus === "Inactive"}
                                deleteMessage={deleteMessage}
                              />
                            )}
                          </>
                        )}
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
            {Math.min(safePage * ITEMS_PER_PAGE, filteredAndSortedData.length)} of{" "}
            {filteredAndSortedData.length} {entityName}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage === 1}
              className="p-2 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
                    className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                      safePage === pageNum
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
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage === totalPages}
              className="p-2 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

