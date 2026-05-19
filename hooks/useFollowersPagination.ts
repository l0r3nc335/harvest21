import { useInfiniteQuery } from "@tanstack/react-query";
import type { PaginatedResponse, UserFollowerItem, MissionaryFollowerItem } from "@/types/pagination";

async function fetchUserFollowers(
  missionaryId: number,
  page: number,
  pageSize: number
): Promise<PaginatedResponse<UserFollowerItem>> {
  const response = await fetch(
    `/api/missionaries/${missionaryId}/followers/users?page=${page}&limit=${pageSize}`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch user followers");
  }
  
  return response.json();
}

async function fetchMissionaryFollowers(
  missionaryId: number,
  page: number,
  pageSize: number
): Promise<PaginatedResponse<MissionaryFollowerItem>> {
  const response = await fetch(
    `/api/missionaries/${missionaryId}/followers/missionaries?page=${page}&limit=${pageSize}`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch missionary followers");
  }
  
  return response.json();
}

export function useUserFollowersInfinite(
  missionaryId: number,
  pageSize: number = 10
) {
  const query = useInfiniteQuery({
    queryKey: ["missionaries", missionaryId, "followers", "users", pageSize],
    queryFn: ({ pageParam = 1 }) => fetchUserFollowers(missionaryId, pageParam, pageSize),
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

export function useMissionaryFollowersInfinite(
  missionaryId: number,
  pageSize: number = 10
) {
  const query = useInfiniteQuery({
    queryKey: ["missionaries", missionaryId, "followers", "missionaries", pageSize],
    queryFn: ({ pageParam = 1 }) => fetchMissionaryFollowers(missionaryId, pageParam, pageSize),
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
