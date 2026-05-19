"use client";
import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";

type MissionaryDonationsTabProps = {
  missionaryId: number;
  pageId: number | null;
  onGetDonations: (
    pageId: number
  ) => Promise<{ success: boolean; data?: unknown[]; message?: string }>;
};

type Donation = {
  id: number;
  transaction_ref: string;
  date: string;
  donor_id: number;
  donor?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  donor_first_name?: string | null;
  donor_last_name?: string | null;
  donor_email?: string | null;
  amount: number;
  net_amount?: number;
  status: "Pending" | "Complete" | "Failed" | "Refunded" | "Disputed";
  type: string;
  designation?: string | null;
};

export function MissionaryDonationsTab({
  missionaryId,
  pageId,
  onGetDonations,
}: MissionaryDonationsTabProps) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalReceived, setTotalReceived] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!pageId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await onGetDonations(pageId);
        if (result.success && result.data) {
          const donationsData = result.data as Donation[];
          setDonations(donationsData);

          const received = donationsData
            .filter((d) => d.status === "Complete")
            .reduce((sum, d) => sum + (d.amount || 0), 0);

          setTotalReceived(received);
        }
      } catch (error) {
        console.error("Error fetching donations:", error);
        toast.error("Failed to load donations");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [pageId, onGetDonations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}, ${year}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Complete":
        return <Badge variant="success">COMPLETE</Badge>;
      case "Failed":
        return <Badge variant="danger">FAILED</Badge>;
      case "Refunded":
        return <Badge variant="warning">REFUNDED</Badge>;
      case "Disputed":
        return <Badge variant="danger">DISPUTED</Badge>;
      case "Pending":
      default:
        return <Badge variant="warning">IN-PROGRESS</Badge>;
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Transaction #", "Date", "Donor Name", "Donor Email", "Net Amount", "Gross Amount", "Type", "Designation", "Status"],
      ...donations.map((d) => {
        const donorName = [d.donor_first_name ?? d.donor?.first_name, d.donor_last_name ?? d.donor?.last_name].filter(Boolean).join(" ");
        const donorEmail = d.donor_email ?? d.donor?.email ?? "";
        return [
          d.transaction_ref,
          formatDate(d.date),
          donorName,
          donorEmail,
          formatCurrency(d.net_amount ?? d.amount),
          formatCurrency(d.amount),
          d.type,
          d.designation || "",
          d.status,
        ];
      }),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `missionary-donations-${missionaryId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  const LoadingTableRows = () => (
    <>
      {[...Array(3)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 lg:px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-32 dark:bg-zinc-800"></div>
          </td>
          <td className="px-4 lg:px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-24 dark:bg-zinc-800"></div>
          </td>
          <td className="px-4 lg:px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-16 dark:bg-zinc-800"></div>
          </td>
          <td className="px-4 lg:px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-20 dark:bg-zinc-800"></div>
          </td>
          <td className="px-4 lg:px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-24 dark:bg-zinc-800"></div>
          </td>
          <td className="px-4 lg:px-6 py-4">
            <div className="h-6 bg-zinc-200 rounded-full w-20 dark:bg-zinc-800"></div>
          </td>
          <td className="px-4 lg:px-6 py-4 text-right">
            <div className="h-8 bg-zinc-200 rounded w-20 ml-auto dark:bg-zinc-800"></div>
          </td>
        </tr>
      ))}
    </>
  );

  const LoadingCards = () => (
    <>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="h-3 bg-zinc-200 rounded w-24 mb-2 dark:bg-zinc-800"></div>
              <div className="h-4 bg-zinc-200 rounded w-32 dark:bg-zinc-800"></div>
            </div>
            <div className="h-6 bg-zinc-200 rounded-full w-20 dark:bg-zinc-800"></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="h-3 bg-zinc-200 rounded w-16 mb-2 dark:bg-zinc-800"></div>
              <div className="h-4 bg-zinc-200 rounded w-20 dark:bg-zinc-800"></div>
            </div>
            <div>
              <div className="h-3 bg-zinc-200 rounded w-16 mb-2 dark:bg-zinc-800"></div>
              <div className="h-4 bg-zinc-200 rounded w-20 dark:bg-zinc-800"></div>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Donations</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={handleExportCSV} 
            disabled={isLoading}
            className="flex items-center gap-2 h-9 px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Export CSV</span>
            <span className="xs:hidden">Export</span>
          </Button>
          <Dropdown 
            label="Sort By" 
            selectedValue="Sort By"
            className="[&_button]:h-9 [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs sm:[&_button]:text-sm"
          >
            <DropdownItem onClick={() => {}}>Date (Newest)</DropdownItem>
            <DropdownItem onClick={() => {}}>Date (Oldest)</DropdownItem>
            <DropdownItem onClick={() => {}}>Amount</DropdownItem>
          </Dropdown>
          <Dropdown 
            label="Filters" 
            selectedValue="Filters"
            className="[&_button]:h-9 [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs sm:[&_button]:text-sm"
          >
            <DropdownItem onClick={() => {}}>All</DropdownItem>
            <DropdownItem onClick={() => {}}>Pending</DropdownItem>
            <DropdownItem onClick={() => {}}>Complete</DropdownItem>
            <DropdownItem onClick={() => {}}>Failed</DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">Total Amount Received</p>
          {isLoading ? (
            <div className="h-8 bg-zinc-200 rounded w-32 animate-pulse dark:bg-zinc-800"></div>
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(totalReceived)}</p>
          )}
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                TRANSACTION #
              </th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                DATE
              </th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                DONOR
              </th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                NET AMOUNT
              </th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                TYPE
              </th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                DESIGNATION
              </th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                STATUS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {isLoading ? (
              <LoadingTableRows />
            ) : donations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 lg:px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No donations available
                </td>
              </tr>
            ) : (
              donations.map((donation) => (
                <tr key={donation.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100">
                    {donation.transaction_ref}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(donation.date)}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-sm">
                    {(donation.donor_first_name || donation.donor?.first_name) ? (
                      <>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {[donation.donor_first_name ?? donation.donor?.first_name, donation.donor_last_name ?? donation.donor?.last_name].filter(Boolean).join(" ")}
                        </div>
                        {(donation.donor_email ?? donation.donor?.email) && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                            {donation.donor_email ?? donation.donor?.email}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(donation.net_amount ?? donation.amount)}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                    {donation.type === "recurring" ? "Monthly" : "One-time"}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-[160px]">
                    {donation.designation ? (
                      <span className="truncate block" title={donation.designation}>{donation.designation}</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                    {getStatusBadge(donation.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          <LoadingCards />
        ) : donations.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No donations available
          </div>
        ) : (
          donations.map((donation) => (
            <div
              key={donation.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Transaction #
                  </p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {donation.transaction_ref}
                  </p>
                </div>
                <div className="shrink-0">
                  {getStatusBadge(donation.status)}
                </div>
              </div>
              
              {(donation.donor_first_name || donation.donor?.first_name) && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Donor
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {[donation.donor_first_name ?? donation.donor?.first_name, donation.donor_last_name ?? donation.donor?.last_name].filter(Boolean).join(" ")}
                  </p>
                  {(donation.donor_email ?? donation.donor?.email) && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {donation.donor_email ?? donation.donor?.email}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Date
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {formatDate(donation.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Net Amount
                  </p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(donation.net_amount ?? donation.amount)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Type
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {donation.type === "recurring" ? "Monthly" : "One-time"}
                  </p>
                </div>
              </div>

              {donation.designation && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Designation
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {donation.designation}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

