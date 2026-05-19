-- One receipt row per donation; dedupe existing duplicates (keep newest with sent_at preferred).
DELETE FROM public.donation_receipts dr
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY page_donation_id
        ORDER BY
          CASE WHEN sent_at IS NOT NULL THEN 0 ELSE 1 END,
          id DESC
      ) AS rn
    FROM public.donation_receipts
  ) ranked
  WHERE ranked.rn > 1
) doomed
WHERE dr.id = doomed.id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_donation_receipts_page_donation_id
  ON public.donation_receipts (page_donation_id);
