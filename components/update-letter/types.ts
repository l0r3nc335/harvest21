export type UpdateLetter = {
  id: number;
  widget_type: string;
  widget_title: string;
  widget_data: {
    pdf_url?: string;
    thumbnail_url?: string;
    description?: string;
    view_count?: number;
  };
  created_at: string;
};

