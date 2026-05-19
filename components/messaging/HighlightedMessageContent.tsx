import React from "react";

interface HighlightedMessageContentProps {
  content: string;
  highlightKeyword: string | null;
}

export const HighlightedMessageContent = React.memo(function HighlightedMessageContent({
  content,
  highlightKeyword,
}: HighlightedMessageContentProps) {
  if (!highlightKeyword?.trim()) {
    return <>{content}</>;
  }

  const lower = content.toLowerCase();
  const kw = highlightKeyword.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let idx = lower.indexOf(kw);

  while (idx !== -1) {
    if (idx > start) {
      parts.push(content.slice(start, idx));
    }
    parts.push(
      <mark
        key={idx}
        className="bg-yellow-300/80 text-inherit font-medium rounded px-0.5"
      >
        {content.slice(idx, idx + kw.length)}
      </mark>,
    );
    start = idx + kw.length;
    idx = lower.indexOf(kw, start);
  }

  if (start < content.length) {
    parts.push(content.slice(start));
  }

  return <>{parts}</>;
});
