import { MissionariesByRegionClient } from "@/components/missionaries/MissionariesByRegionClient";
import { getMissionariesByRegion } from "./actions";
import { getCurrentUserProfile } from "@/lib/userActions";

type MissionariesContentProps = {
  region: string;
  page: number;
  limit: number;
};

export async function MissionariesContent({ region, page, limit }: MissionariesContentProps) {
  const [paginatedResponse, userProfile] = await Promise.all([
    getMissionariesByRegion(region, page, limit),
    getCurrentUserProfile(),
  ]);

  const userRole = userProfile?.role || null;
  const isLoggedIn = !!userProfile;

  return (
    <MissionariesByRegionClient 
      paginatedResponse={paginatedResponse} 
      region={region}
      userRole={userRole}
      isLoggedIn={isLoggedIn}
    />
  );
}
