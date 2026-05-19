"use client";
import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Avatar } from "@/components/ui/Avatar";
import { MoreVertical, FileUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Missionary } from "@/types/missionary";

type SortOption = "name-asc" | "name-desc" | "activity" | "status" | "";
type FilterOption = {
  missionStatus?: Missionary["missionStatus"];
  accountStatus?: Missionary["accountStatus"];
  location?: string;
};

type EntityMissionariesTabProps = {
  entityId: number;
  entityName: string;
  entityType: "college" | "agency" | "church";
  onFetchMissionaries: (entityId: number) => Promise<Missionary[]>;
};

export function EntityMissionariesTab({ 
  entityId, 
  entityName, 
  entityType,
  onFetchMissionaries 
}: EntityMissionariesTabProps) {
  const router = useRouter();
  const [missionaries, setMissionaries] = useState<Missionary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("");
  const [filters, setFilters] = useState<FilterOption>({});

  useEffect(() => {
    async function fetchMissionaries() {
      setIsLoading(true);
      try {
        const data = await onFetchMissionaries(entityId);
        setMissionaries(data);
      } catch (error) {
        console.error("Error fetching missionaries:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMissionaries();
  }, [entityId, onFetchMissionaries]);

  // Get unique locations for filtering
  const uniqueLocations = useMemo(() => {
    const locations = new Set(missionaries.map((m) => m.location));
    return Array.from(locations).sort();
  }, [missionaries]);

  // Filter and sort missionaries
  const filteredAndSortedMissionaries = useMemo(() => {
    let result = [...missionaries];

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
      result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
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
  }, [missionaries, sortBy, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleSort = (option: SortOption) => {
    setSortBy(option);
  };

  const handleFilter = (type: keyof FilterOption, value: string | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
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
  };

  const clearFilters = () => {
    setFilters({});
    setSortBy("");
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

  const getAccountStatusBadge = (status: Missionary["accountStatus"]) => {
    switch (status) {
      case "Active":
        return <Badge variant="success">{status}</Badge>;
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

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center py-8">
          <p className="text-zinc-500">Loading missionaries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Missionaries</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown label="Sort By" selectedValue={sortBy || "Sort By"}>
            <DropdownItem onClick={() => handleSort("")}>None</DropdownItem>
            <DropdownItem onClick={() => handleSort("name-asc")}>Name (A-Z)</DropdownItem>
            <DropdownItem onClick={() => handleSort("name-desc")}>Name (Z-A)</DropdownItem>
            <DropdownItem onClick={() => handleSort("activity")}>Last Activity</DropdownItem>
            <DropdownItem onClick={() => handleSort("status")}>Status</DropdownItem>
          </Dropdown>
          <Dropdown
            label="Filters"
            badge={activeFilterCount}
            selectedValue={activeFilterCount > 0 ? `${activeFilterCount} active` : "Filters"}
          >
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
            <DropdownItem onClick={() => handleFilter("accountStatus", "Inactive")}>
              Account Status: Inactive
            </DropdownItem>
            {uniqueLocations.map((location) => (
              <DropdownItem key={location} onClick={() => handleFilter("location", location)}>
                Location: {location}
              </DropdownItem>
            ))}
            {activeFilterCount > 0 && (
              <>
                <div className="border-t border-zinc-200 my-1 dark:border-zinc-800" />
                <DropdownItem onClick={clearFilters}>Clear Filters</DropdownItem>
              </>
            )}
          </Dropdown>
          {/* <Button variant="secondary" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Import CSV
          </Button> */}
          <Button variant="primary" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      {/* Missionaries List */}
      {filteredAndSortedMissionaries.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500">No data available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedMissionaries.map((missionary) => (
            <div
              key={missionary.id}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Avatar
                size="md"
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(missionary.name)}&background=random&color=fff&size=128`}
                alt={missionary.name}
                fallback={missionary.name.charAt(0)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-zinc-900 truncate">{missionary.name}</h3>
                  <span className="text-sm text-zinc-500">{missionary.location}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {getMissionStatusBadge(missionary.missionStatus)}
                  {getAccountStatusBadge(missionary.accountStatus)}
                </div>
              </div>
              <div className="text-sm text-zinc-500">{missionary.lastActivity}</div>
              <Button
                variant="secondary"
                onClick={() => router.push(`/admin/missionaries/${missionary.id}`)}
              >
                Manage Page
              </Button>
              <button className="p-2 text-zinc-600 hover:text-zinc-900">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

