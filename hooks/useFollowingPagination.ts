import { useInfiniteQuery } from "@tanstack/react-query";
import type { PaginatedResponse, MissionaryFollowingItem } from "@/types/pagination";

async function fetchMissionaryFollowing(
  page: number,
  pageSize: number
): Promise<PaginatedResponse<MissionaryFollowingItem>> {
  const response = await fetch(
    `/api/missionaries/following?page=${page}&limit=${pageSize}`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch missionary following");
  }
  
  return response.json();
}

export function useMissionaryFollowingInfinite(pageSize: number = 10) {
  const query = useInfiniteQuery({
    queryKey: ["missionaries", "following", pageSize],
    queryFn: ({ pageParam = 1 }) => fetchMissionaryFollowing(pageParam, pageSize),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const allItems = query.data?.pages.flatMap((page) => page.items) || [];
  const uniqueItems = Array.from(
    new Map(allItems.map((item) => [item.id, item])).values()
  );

  return {
    ...query,
    items: uniqueItems,
  };
}
