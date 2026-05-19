-- Update "Who We Are" to "Personal Bio" for all existing missionary pages
-- This migration updates the template_content JSON field for all missionary pages

DO $$
DECLARE
  page_record RECORD;
  template_content_json JSONB;
  updated_content JSONB;
  header_title_value TEXT;
BEGIN
  -- Loop through all missionary pages
  FOR page_record IN 
    SELECT id, template_content 
    FROM public.pages 
    WHERE organization_type = 'missionary' 
      AND template_content IS NOT NULL
  LOOP
    BEGIN
      -- Parse the template_content JSON
      template_content_json := page_record.template_content::JSONB;
      
      -- Check if the fields object exists and contains headerTitle
      IF template_content_json ? 'fields' 
         AND template_content_json->'fields' ? 'headerTitle' THEN
        
        -- Get the current value
        header_title_value := template_content_json->'fields'->>'headerTitle';
        
        -- Only update if it contains the old text
        IF header_title_value = 'Who We Are' THEN
          -- Update the headerTitle field
          updated_content := jsonb_set(
            template_content_json,
            '{fields,headerTitle}',
            '"Personal Bio"'::JSONB
          );
          
          -- Update the page record
          UPDATE public.pages
          SET template_content = updated_content::TEXT,
              updated_at = NOW()
          WHERE id = page_record.id;
          
          RAISE NOTICE 'Updated page ID %: Changed "Who We Are" to "Personal Bio"', page_record.id;
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue with other pages
        RAISE WARNING 'Error processing page ID %: %', page_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: Updated headerTitle for all missionary pages';
END $$;
