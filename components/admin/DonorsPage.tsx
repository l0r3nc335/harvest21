"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Avatar } from "@/components/ui/Avatar";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { deleteDonor, toggleDonorStatus } from "@/app/admin/donors/actions";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateDonorForm } from "@/components/admin/CreateDonorForm";
import type { Donor } from "@/types/donor";

const ITEMS_PER_PAGE = 10;

type SortOption = "name-asc" | "name-desc" | "donations-asc" | "donations-desc" | "date-asc" | "date-desc" | "status" | "";
type FilterOption = {
  status?: Donor["status"];
  location?: string;
};

type DonorsPageClientProps = {
  initialDonors: Donor[];
};

export function DonorsPageClient({ initialDonors }: DonorsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [donors] = useState<Donor[]>(initialDonors);
  const isInitialMount = useRef(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Get initial state from URL params
  const initialSort = (searchParams.get("sort") as SortOption) || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialStatusFilter = searchParams.get("status") as Donor["status"] | null;
  const initialLocationFilter = searchParams.get("location") || null;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [filters, setFilters] = useState<FilterOption>({
    status: initialStatusFilter || undefined,
    location: initialLocationFilter || undefined,
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
    if (filters.status) params.set("status", filters.status);
    if (filters.location) params.set("location", filters.location);
    
    const queryString = params.toString();
    router.push(`/admin/donors${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [sortBy, filters, currentPage, router]);

  // Get unique locations for filtering
  const uniqueLocations = useMemo(() => {
    const locations = new Set(
      donors
        .map((donor) => donor.location)
        .filter((loc): loc is string => Boolean(loc))
    );
    return Array.from(locations).sort();
  }, [donors]);

  // Filter and sort donors
  const filteredAndSortedDonors = useMemo(() => {
    let result = [...donors];

    // Apply filters
    if (filters.status) {
      result = result.filter((d) => d.status === filters.status);
    }
    if (filters.location) {
      result = result.filter((d) => d.location === filters.location);
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
    } else if (sortBy === "donations-asc") {
      result.sort((a, b) => a.total_donations - b.total_donations);
    } else if (sortBy === "donations-desc") {
      result.sort((a, b) => b.total_donations - a.total_donations);
    } else if (sortBy === "date-asc") {
      result.sort((a, b) => {
        const dateA = a.last_donation_date ? new Date(a.last_donation_date).getTime() : 0;
        const dateB = b.last_donation_date ? new Date(b.last_donation_date).getTime() : 0;
        return dateA - dateB;
      });
    } else if (sortBy === "date-desc") {
      result.sort((a, b) => {
        const dateA = a.last_donation_date ? new Date(a.last_donation_date).getTime() : 0;
        const dateB = b.last_donation_date ? new Date(b.last_donation_date).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === "status") {
      result.sort((a, b) => {
        const statusOrder = ["Active", "Pending", "Inactive"];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        return aIndex - bIndex;
      });
    }

    return result;
  }, [donors, sortBy, filters]);

  const totalPages = Math.ceil(filteredAndSortedDonors.length / ITEMS_PER_PAGE);

  const paginatedDonors = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedDonors.slice(startIndex, endIndex);
  }, [filteredAndSortedDonors, currentPage]);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null
  ).length;

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
        if (type === "status") {
          newFilters[type] = value as Donor["status"];
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
  };

  const getStatusBadge = (status: Donor["status"]) => {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  const handleExportCSV = () => {
    // Create CSV content
    const headers = ["Donor ID", "Name", "Email", "Phone", "Location", "Total Donations", "Transaction Count", "Average Donation", "Last Donation", "Status"];
    const rows = filteredAndSortedDonors.map((donor) => [
      donor.donor_id,
      `${donor.first_name} ${donor.last_name}`,
      donor.email || "",
      donor.phone || "",
      donor.location || "",
      formatCurrency(donor.total_donations),
      donor.transaction_count.toString(),
      formatCurrency(donor.average_donation),
      donor.last_donation_date ? formatDate(donor.last_donation_date) : "Never",
      donor.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `donors_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteDonor(id);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete donor");
    }
  };

  const handleDisable = async (id: string) => {
    const donor = donors.find((d) => d.id === id);
    const isDisabled = donor?.status === "Active";
    
    const result = await toggleDonorStatus(id, isDisabled);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update donor status");
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Page Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Donors</h1>
        
        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button
            variant="secondary"
            className="text-sm px-3 py-2 w-full sm:w-auto flex items-center gap-2"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          
          <Dropdown 
            label="Sort By" 
            className="w-full sm:w-auto"
            selectedValue={
              sortBy === "name-asc" ? "Name (A-Z)" :
              sortBy === "name-desc" ? "Name (Z-A)" :
              sortBy === "donations-asc" ? "Total Donations (Low to High)" :
              sortBy === "donations-desc" ? "Total Donations (High to Low)" :
              sortBy === "date-asc" ? "Last Donation (Oldest)" :
              sortBy === "date-desc" ? "Last Donation (Newest)" :
              sortBy === "status" ? "Status" :
              undefined
            }
          >
            <DropdownItem onClick={() => handleSort("name-asc")}>Name (A-Z)</DropdownItem>
            <DropdownItem onClick={() => handleSort("name-desc")}>Name (Z-A)</DropdownItem>
            <DropdownItem onClick={() => handleSort("donations-desc")}>Total Donations (High to Low)</DropdownItem>
            <DropdownItem onClick={() => handleSort("donations-asc")}>Total Donations (Low to High)</DropdownItem>
            <DropdownItem onClick={() => handleSort("date-desc")}>Last Donation (Newest)</DropdownItem>
            <DropdownItem onClick={() => handleSort("date-asc")}>Last Donation (Oldest)</DropdownItem>
            <DropdownItem onClick={() => handleSort("status")}>Status</DropdownItem>
            {sortBy && <DropdownItem onClick={() => handleSort("")}>Clear Sort</DropdownItem>}
          </Dropdown>
          
          <Dropdown label="Filters" badge={activeFilterCount} className="w-full sm:w-auto">
            <DropdownItem 
              onClick={() => handleFilter("status", "Active")}
              className={filters.status === "Active" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: Active
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "Pending")}
              className={filters.status === "Pending" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: Pending
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "Inactive")}
              className={filters.status === "Inactive" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: Inactive
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
          
          <Button
            variant="primary"
            className="text-sm px-3 py-2 w-full sm:w-auto"
            onClick={() => setIsFormOpen(true)}
          >
            + Create New
          </Button>
        </div>
      </div>

      {/* Table Container - Mobile Responsive */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-full">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-zinc-200">
            {paginatedDonors.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No data available
              </div>
            ) : (
              paginatedDonors.map((donor) => (
                <div key={donor.id} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar
                        size="sm"
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(`${donor.first_name} ${donor.last_name}`)}&background=random&color=fff&size=128`}
                        alt={`${donor.first_name} ${donor.last_name}`}
                        fallback={getInitials(donor.first_name, donor.last_name)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {donor.first_name} {donor.last_name}
                        </div>
                        <div className="text-xs text-zinc-500">ID: {donor.donor_id}</div>
                        {donor.email && (
                          <div className="text-xs text-zinc-500 truncate">{donor.email}</div>
                        )}
                        {donor.phone && (
                          <div className="text-xs text-zinc-500">{donor.phone}</div>
                        )}
                        {donor.location && (
                          <div className="text-xs text-zinc-500">{donor.location}</div>
                        )}
                      </div>
                    </div>
                        <KebabMenu
                          onDelete={() => handleDelete(donor.id)}
                          onDisable={() => handleDisable(donor.id)}
                          isDisabled={donor.status !== "Active"}
                          deleteMessage="Are you sure you want to delete this donor? This will also delete all related data."
                        />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Total Donations</span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {formatCurrency(donor.total_donations)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Transactions</span>
                      <span className="text-sm text-zinc-700">{donor.transaction_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Average Donation</span>
                      <span className="text-sm text-zinc-700">{formatCurrency(donor.average_donation)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Last Donation</span>
                      <span className="text-sm text-zinc-700">{formatDate(donor.last_donation_date)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                      <div>{getStatusBadge(donor.status)}</div>
                      <div className="text-xs text-zinc-500">
                        {formatLastActivity(donor.last_activity)}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="text-xs px-2 py-1 w-full mt-2"
                      onClick={() => console.log("View details", donor.id)}
                    >
                      View Details
                    </Button>
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
                  DONOR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  CONTACT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  TOTAL DONATIONS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  TRANSACTIONS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  LAST DONATION
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  STATUS
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-700">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {paginatedDonors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedDonors.map((donor) => (
                  <tr key={donor.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size="sm"
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(`${donor.first_name} ${donor.last_name}`)}&background=random&color=fff&size=128`}
                          alt={`${donor.first_name} ${donor.last_name}`}
                          fallback={getInitials(donor.first_name, donor.last_name)}
                        />
                        <div>
                          <div className="text-sm font-medium text-zinc-900">
                            {donor.first_name} {donor.last_name}
                          </div>
                          <div className="text-xs text-zinc-500">ID: {donor.donor_id}</div>
                          {donor.location && (
                            <div className="text-xs text-zinc-500">{donor.location}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-900">
                        {donor.email && (
                          <div className="text-zinc-700">{donor.email}</div>
                        )}
                        {donor.phone && (
                          <div className="text-xs text-zinc-500">{donor.phone}</div>
                        )}
                        {!donor.email && !donor.phone && (
                          <div className="text-xs text-zinc-400">No contact info</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-zinc-900">
                        {formatCurrency(donor.total_donations)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Avg: {formatCurrency(donor.average_donation)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-900">{donor.transaction_count}</div>
                      <div className="text-xs text-zinc-500">transactions</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-500">{formatDate(donor.last_donation_date)}</div>
                      {donor.last_activity && (
                        <div className="text-xs text-zinc-400">
                          Activity: {formatLastActivity(donor.last_activity)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(donor.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="text-sm px-3 py-1.5"
                          onClick={() => console.log("View details", donor.id)}
                        >
                          View Details
                        </Button>
                        <KebabMenu
                          onDelete={() => handleDelete(donor.id)}
                          onDisable={() => handleDisable(donor.id)}
                          isDisabled={donor.status !== "Active"}
                          deleteMessage="Are you sure you want to delete this donor? This will also delete all related data."
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
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedDonors.length)} of{" "}
            {filteredAndSortedDonors.length} donors
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
      
      {/* Create Donor Form Panel */}
      <CreateDonorForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={(data) => {
          console.log("Form submitted:", data);
          // Here you would typically send the data to your API
          // For now, we'll just log it and close the form
        }}
      />
    </div>
  );
}

