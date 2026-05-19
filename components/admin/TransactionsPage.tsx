"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { TransactionDetailModal } from "@/components/admin/TransactionDetailModal";
import type { Transaction } from "@/types/transaction";

const ITEMS_PER_PAGE = 10;

type SortOption = "date-asc" | "date-desc" | "amount-asc" | "amount-desc" | "transaction-asc" | "transaction-desc" | "status" | "";
type FilterOption = {
  status?: Transaction["status"];
  type?: Transaction["type"];
};

type TransactionsPageClientProps = {
  initialTransactions: Transaction[];
};

export function TransactionsPageClient({ initialTransactions }: TransactionsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions] = useState<Transaction[]>(initialTransactions);
  const isInitialMount = useRef(true);
  
  // Get initial state from URL params
  const initialSort = (searchParams.get("sort") as SortOption) || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialStatusFilter = searchParams.get("status") as Transaction["status"] | null;
  const initialTypeFilter = searchParams.get("type") as Transaction["type"] | null;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [filters, setFilters] = useState<FilterOption>({
    status: initialStatusFilter || undefined,
    type: initialTypeFilter || undefined,
  });
  const [searchEmail, setSearchEmail] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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
    if (filters.type) params.set("type", filters.type);
    
    const queryString = params.toString();
    router.push(`/admin/transactions${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [sortBy, filters, currentPage, router]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    if (filters.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.type) {
      result = result.filter((t) => t.type === filters.type);
    }
    if (searchEmail.trim()) {
      const q = searchEmail.trim().toLowerCase();
      result = result.filter(
        (t) =>
          (t.donor_email && t.donor_email.toLowerCase().includes(q)) ||
          (t.donor_name && t.donor_name.toLowerCase().includes(q)) ||
          (t.recipient_name && t.recipient_name.toLowerCase().includes(q))
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((t) => new Date(t.date).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      result = result.filter((t) => new Date(t.date).getTime() < to);
    }
    if (sortBy === "date-asc") {
      result.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
    } else if (sortBy === "date-desc") {
      result.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    } else if (sortBy === "amount-asc") {
      result.sort((a, b) => a.received - b.received);
    } else if (sortBy === "amount-desc") {
      result.sort((a, b) => b.received - a.received);
    } else if (sortBy === "transaction-asc") {
      result.sort((a, b) => a.transaction_number.localeCompare(b.transaction_number));
    } else if (sortBy === "transaction-desc") {
      result.sort((a, b) => b.transaction_number.localeCompare(a.transaction_number));
    } else if (sortBy === "status") {
      result.sort((a, b) => {
        const statusOrder = ["COMPLETE", "PENDING", "FAILED", "CANCELLED"];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        return aIndex - bIndex;
      });
    }

    return result;
  }, [transactions, sortBy, filters, searchEmail, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredAndSortedTransactions.length / ITEMS_PER_PAGE);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedTransactions.slice(startIndex, endIndex);
  }, [filteredAndSortedTransactions, currentPage]);

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
          newFilters[type] = value as Transaction["status"];
        } else if (type === "type") {
          newFilters[type] = value as Transaction["type"];
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

  const getStatusBadge = (status: Transaction["status"]) => {
    switch (status) {
      case "COMPLETE":
        return <Badge variant="success">{status}</Badge>;
      case "PENDING":
        return <Badge variant="warning">{status}</Badge>;
      case "FAILED":
        return <Badge variant="danger">{status}</Badge>;
      case "CANCELLED":
        return <Badge variant="default">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: Transaction["type"]) => {
    return (
      <Badge variant="default" className="bg-zinc-100 text-zinc-800">
        {type}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    const headers = [
      "Donation ID",
      "Donor First Name",
      "Donor Last Name",
      "Donor Email",
      "Mission Agency",
      "Donation Date (UTC)",
      "Base Donation Amount",
      "Processing Fee",
      "Gross Charged Amount",
      "Net Credited Amount",
      "Currency",
      "One-time vs Recurring",
      "Designation",
      "Receipt ID",
      "Receipt Sent Timestamp",
      "Stripe PaymentIntent ID",
      "Stripe Subscription ID",
      "Stripe Invoice ID",
      "Status",
    ];

    const rows = filteredAndSortedTransactions.map((t) => {
      const nameParts = (t.donor_name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      return [
        t.id,
        firstName,
        lastName,
        t.donor_email || "",
        t.mission_agency_name || "",
        t.date,
        String(t.base_amount ?? t.received),
        String(t.processing_fee ?? ""),
        String(t.gross_amount ?? t.received),
        String(t.net_amount ?? ""),
        "USD",
        t.donation_type === "recurring" ? "recurring" : "one_time",
        t.designation || "",
        t.receipt_id || "",
        t.receipt_sent_at || "",
        t.stripe_payment_intent_id || "",
        t.stripe_subscription_id || "",
        t.stripe_invoice_id || "",
        t.status,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `donations_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Page Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Transactions</h1>
        
        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button
            variant="primary"
            className="text-sm px-3 py-2 w-full sm:w-auto flex items-center gap-2 bg-[#D3AF37] text-black hover:bg-[#C19E2E]"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          
          <Dropdown 
            label="Sort By" 
            className="w-full sm:w-auto"
            selectedValue={
              sortBy === "date-desc" ? "Date (Newest)" :
              sortBy === "date-asc" ? "Date (Oldest)" :
              sortBy === "amount-desc" ? "Amount (High to Low)" :
              sortBy === "amount-asc" ? "Amount (Low to High)" :
              sortBy === "transaction-asc" ? "Transaction # (A-Z)" :
              sortBy === "transaction-desc" ? "Transaction # (Z-A)" :
              sortBy === "status" ? "Status" :
              undefined
            }
          >
            <DropdownItem onClick={() => handleSort("date-desc")}>Date (Newest)</DropdownItem>
            <DropdownItem onClick={() => handleSort("date-asc")}>Date (Oldest)</DropdownItem>
            <DropdownItem onClick={() => handleSort("amount-desc")}>Amount (High to Low)</DropdownItem>
            <DropdownItem onClick={() => handleSort("amount-asc")}>Amount (Low to High)</DropdownItem>
            <DropdownItem onClick={() => handleSort("transaction-asc")}>Transaction # (A-Z)</DropdownItem>
            <DropdownItem onClick={() => handleSort("transaction-desc")}>Transaction # (Z-A)</DropdownItem>
            <DropdownItem onClick={() => handleSort("status")}>Status</DropdownItem>
            {sortBy && <DropdownItem onClick={() => handleSort("")}>Clear Sort</DropdownItem>}
          </Dropdown>
          
          <Dropdown label="Filters" badge={activeFilterCount} className="w-full sm:w-auto">
            <DropdownItem 
              onClick={() => handleFilter("status", "COMPLETE")}
              className={filters.status === "COMPLETE" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: COMPLETE
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "PENDING")}
              className={filters.status === "PENDING" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: PENDING
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "FAILED")}
              className={filters.status === "FAILED" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: FAILED
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("status", "CANCELLED")}
              className={filters.status === "CANCELLED" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Status: CANCELLED
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("type", "DONATION")}
              className={filters.type === "DONATION" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Type: DONATION
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("type", "REFUND")}
              className={filters.type === "REFUND" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Type: REFUND
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("type", "TRANSFER")}
              className={filters.type === "TRANSFER" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Type: TRANSFER
            </DropdownItem>
            <DropdownItem 
              onClick={() => handleFilter("type", "OTHER")}
              className={filters.type === "OTHER" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              Type: OTHER
            </DropdownItem>
            {activeFilterCount > 0 && (
              <DropdownItem onClick={clearFilters}>
                Clear All Filters
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      </div>

      {/* Search & Date Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Search by donor email or name…"
            value={searchEmail}
            onChange={(e) => { setSearchEmail(e.target.value); setCurrentPage(1); }}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-zinc-500 whitespace-nowrap">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <label className="text-xs text-zinc-500 whitespace-nowrap">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Table Container - Mobile Responsive */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-full">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-zinc-200">
            {paginatedTransactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No data available
              </div>
            ) : (
              paginatedTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">
                        #{transaction.transaction_number}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{formatDate(transaction.date)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-sm font-bold text-zinc-900">
                        {formatCurrency(transaction.received)}
                      </div>
                      {getStatusBadge(transaction.status)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {transaction.donor_name && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-500 shrink-0">Donor</span>
                        <span className="text-xs font-medium text-zinc-700 text-right truncate max-w-[160px]">{transaction.donor_name}</span>
                      </div>
                    )}
                    {transaction.donor_email && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-500 shrink-0">Email</span>
                        <span className="text-xs text-zinc-700 text-right truncate max-w-[160px]">{transaction.donor_email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Recipient</span>
                      <span className="text-xs font-medium text-zinc-700">{transaction.recipient_name || transaction.recipient_id}</span>
                    </div>
                    {transaction.mission_agency_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Agency</span>
                        <span className="text-xs text-zinc-700 text-right truncate max-w-[160px]">
                          {transaction.mission_agency_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Type</span>
                      <div>{getTypeBadge(transaction.type)}</div>
                    </div>
                    {transaction.payment_method && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Payment Method</span>
                        <span className="text-xs text-zinc-700">{transaction.payment_method}</span>
                      </div>
                    )}
                    {transaction.designation && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Designation</span>
                        <span className="text-xs text-zinc-700 max-w-[150px] truncate">{transaction.designation}</span>
                      </div>
                    )}
                    <Button
                      variant="primary"
                      className="text-xs px-3 py-1.5 w-full mt-2 bg-[#D3AF37] text-black hover:bg-[#C19E2E]"
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      Review
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
                  TRANSACTION #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  DATE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  DONOR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  RECEIVED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  TYPE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  DESIGNATION
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700">
                  RECIPIENT ID
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-700">
                  AGENCY
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-700">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-zinc-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-zinc-900">
                        {transaction.transaction_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-500">{formatDate(transaction.date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {transaction.donor_name ? (
                        <>
                          <div className="text-sm font-medium text-zinc-900">{transaction.donor_name}</div>
                          {transaction.donor_email && (
                            <div className="text-xs text-zinc-500 truncate max-w-[180px]">{transaction.donor_email}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-zinc-900">
                        {formatCurrency(transaction.received)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(transaction.type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 max-w-[160px]">
                      {transaction.designation ? (
                        <span className="truncate block" title={transaction.designation}>{transaction.designation}</span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-900">{transaction.recipient_id}</div>
                      {transaction.recipient_name && (
                        <div className="text-xs text-zinc-500">{transaction.recipient_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 max-w-[180px]">
                      {transaction.mission_agency_name ? (
                        <span className="truncate block" title={transaction.mission_agency_name}>
                          {transaction.mission_agency_name}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="primary"
                        className="text-sm px-3 py-1.5 bg-[#D3AF37] text-black hover:bg-[#C19E2E]"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        Review
                      </Button>
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
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedTransactions.length)} of{" "}
            {filteredAndSortedTransactions.length} transactions
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

      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={selectedTransaction !== null}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}

