"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { updateReportStatus } from "@/app/admin/message-reports/actions";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { MessageReportRow } from "@/app/admin/message-reports/fetchActions";

type MessageReportsPageProps = {
  reports: MessageReportRow[];
  isInitialLoading?: boolean;
};

export function MessageReportsPage({ reports: initialReports, isInitialLoading = false }: MessageReportsPageProps) {
  const router = useRouter();
  const [reports, setReports] = useState<MessageReportRow[]>(initialReports);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) =>
      r.reporter_name?.toLowerCase().includes(q) ||
      r.missionary_name?.toLowerCase().includes(q) ||
      r.supporter_name?.toLowerCase().includes(q) ||
      r.message_content?.toLowerCase().includes(q) ||
      r.report_type?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleStatusChange = async (reportId: number, newStatus: "pending" | "reviewed" | "resolved") => {
    const result = await updateReportStatus(reportId, newStatus);
    if (result.success) {
      toast.success("Status updated");
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update status");
    }
  };

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const truncate = (text: string | null, max = 80) =>
    text && text.length > max ? `${text.slice(0, max)}...` : text || "—";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "reviewed":
        return <Badge variant="info">Reviewed</Badge>;
      case "resolved":
        return <Badge variant="success">Resolved</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isInitialLoading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-zinc-900 mb-4">Message Reports</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">
          Loading reports...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Message Reports</h1>
        </div>

        {/* Search Bar. */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, content, type..."
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

      {filteredReports.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">
          {searchQuery ? `No reports matching "${searchQuery}"` : "No message reports yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Reporter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Missionary</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Supporter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Content</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Reported</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredReports.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm text-zinc-900">{r.id}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600 capitalize">{r.report_type}</td>
                  <td className="px-4 py-3 text-sm text-zinc-900">{r.reporter_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-900">{r.missionary_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-900">{r.supporter_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600 max-w-[200px]" title={r.message_content ?? undefined}>
                    {truncate(r.message_content)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(r.status)}
                      <Select
                        options={[
                          { value: "pending", label: "Pending" },
                          { value: "reviewed", label: "Reviewed" },
                          { value: "resolved", label: "Resolved" },
                        ]}
                        value={r.status}
                        onChange={(e) =>
                          handleStatusChange(r.id, e.target.value as "pending" | "reviewed" | "resolved")
                        }
                        className="w-28 text-xs py-1"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
