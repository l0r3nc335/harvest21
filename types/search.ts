export type SearchEntityType = 'missionary' | 'church' | 'agency';

export interface SearchResultBase {
  id: number;
  type: SearchEntityType;
  name: string;
  page_url: string;
  profile_photo_url?: string | null;
}

export interface MissionarySearchResult extends SearchResultBase {
  type: 'missionary';
  first_name: string;
  last_name: string;
  country_of_residence?: string | null;
  destination_country?: string | null;
  agency_name?: string | null;
  agency_id?: number | null;
}

export interface ChurchSearchResult extends SearchResultBase {
  type: 'church';
  city?: string | null;
  country?: string | null;
}

export interface AgencySearchResult extends SearchResultBase {
  type: 'agency';
  city?: string | null;
  country?: string | null;
  affiliated_missionaries?: MissionarySearchResult[];
}

export interface GlobalSearchResponse {
  agencies: AgencySearchResult[];
  missionaries: MissionarySearchResult[];
  churches: ChurchSearchResult[];
  total: number;
}

