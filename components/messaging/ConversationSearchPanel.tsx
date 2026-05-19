"use client";

import React, { useRef, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import type { SearchResult } from "@/lib/messaging/useConversationSearch";
import { HighlightedMessageContent } from "./HighlightedMessageContent";

interface ConversationSearchPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  selectedResultIndex: number;
  onSelectResult: (index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function ConversationSearchPanel({
  query,
  onQueryChange,
  results,
  selectedResultIndex,
  onSelectResult,
  onNext,
  onPrevious,
  onClose,
}: ConversationSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!resultsRef.current) return;
    const activeEl = resultsRef.current.querySelector("[data-active='true']");
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedResultIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (results.length > 0) {
        onSelectResult(selectedResultIndex);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onNext();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onPrevious();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#FAF9F6]">
      <div className="border-b border-zinc-200 p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in conversation..."
          className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
        />
        {query && (
          <span className="text-xs text-zinc-400 shrink-0">
            {results.length > 0
              ? `${selectedResultIndex + 1}/${results.length}`
              : "0 results"}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onPrevious}
            disabled={results.length === 0}
            className="cursor-pointer rounded p-1 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous result"
          >
            <ChevronUp className="w-4 h-4 text-zinc-600" />
          </button>
          <button
            onClick={onNext}
            disabled={results.length === 0}
            className="cursor-pointer rounded p-1 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next result"
          >
            <ChevronDown className="w-4 h-4 text-zinc-600" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded p-1 transition-colors hover:bg-zinc-100"
          title="Close search"
        >
          <X className="w-4 h-4 text-zinc-600" />
        </button>
      </div>

      <div ref={resultsRef} className="flex-1 overflow-y-auto">
        {query.trim() === "" ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Search className="w-8 h-8 text-zinc-300" />
            <span className="text-sm text-zinc-400">Type to search messages</span>
          </div>
        ) : query.trim().length < 2 ? (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400">
            Type at least 2 characters
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400">
            No messages found
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {results.map((result, index) => (
              <button
                key={result.messageId}
                data-active={index === selectedResultIndex}
                onClick={() => onSelectResult(index)}
                className={`w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${
                  index === selectedResultIndex ? "bg-yellow-50" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-700">
                    {result.senderName}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {formatTime(result.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 line-clamp-2">
                  <HighlightedMessageContent
                    content={result.preview}
                    highlightKeyword={query}
                  />
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
