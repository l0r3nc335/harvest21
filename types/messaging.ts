export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: number;
  missionary_id: number;
  supporter_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
}

export type OtherUserType = "missionary" | "supporter" | "church" | "agency" | "college";

export interface ConversationWithDetails extends Conversation {
  missionary_name: string;
  missionary_first_name: string;
  missionary_last_name: string;
  missionary_profile_photo: string | null;
  missionary_page_url: string | null;
  /** Whether the other user's public page is published (only set when missionary_page_url exists) */
  missionary_page_is_published?: boolean;
  page_name: string | null;
  unread_count: number;
  is_missionary: boolean;
  /** Type of the other user in the conversation (missionary, supporter, church, agency, college) */
  other_user_type?: OtherUserType | null;
}

export interface ConversationMember {
  id: number;
  conversation_id: number;
  user_id: string;
  unread_count: number;
  last_read_at: string;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageWithSender extends Message {
  sender_first_name: string;
  sender_last_name: string;
  sender_name: string;
  is_current_user: boolean;
}

export interface MessageReport {
  id: number;
  conversation_id: number;
  message_id: number | null;
  reported_by: string;
  report_type: 'message' | 'conversation';
  reason: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface SendMessageParams {
  conversationId: number;
  content: string;
}

export interface CreateConversationParams {
  missionaryId: number;
}

export interface ReportMessageParams {
  conversationId: number;
  messageId?: number;
  reportType: 'message' | 'conversation';
  reason?: string;
}

