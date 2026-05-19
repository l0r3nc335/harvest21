export type MissionaryPublicationContentType =
  | "update_letter"
  | "prayer"
  | "photo"
  | "video"
  | "text_update";

export type MissionaryNotifySourceTable = "page_media" | "page_widgets" | "prayers";

export interface MissionaryNotifySource {
  sourceTable: MissionaryNotifySourceTable;
  sourceId: number;
}

export interface NotificationContentMetadata {
  focus: string;
  tab: "about" | "update-letters" | "photos" | "videos" | "prayer-wall";
}

export interface ContentUpdateBadgePayload {
  contentType: MissionaryPublicationContentType;
  label: string;
}
