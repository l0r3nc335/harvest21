"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { MessageWithSender } from "@/types/messaging";

export interface SearchResult {
  messageId: number;
  preview: string;
  matchStart: number;
  matchEnd: number;
  senderName: string;
  createdAt: string;
  isCurrentUser: boolean;
}

export function useConversationSearch(messages: MessageWithSender[]) {
  const [query, setQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [highlightTargetId, setHighlightTargetId] = useState<number | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      const idx = content.indexOf(q);
      if (idx !== -1) {
        out.push({
          messageId: msg.id,
          preview: msg.content,
          matchStart: idx,
          matchEnd: idx + q.length,
          senderName: msg.is_current_user ? "You" : msg.sender_name,
          createdAt: msg.created_at,
          isCurrentUser: msg.is_current_user,
        });
      }
    });
    return out;
  }, [messages, query]);

  useEffect(() => {
    setSelectedResultIndex(0);
  }, [results.length, query]);

  const selectResult = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, results.length - 1));
      const r = results[clamped];
      if (!r) return;
      setSelectedResultIndex(clamped);
      setHighlightTargetId(r.messageId);
      setScrollTrigger((c) => c + 1);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightTargetId(null);
      }, 3000);
    },
    [results],
  );

  const nextResult = useCallback(() => {
    if (results.length === 0) return;
    selectResult(selectedResultIndex + 1);
  }, [results.length, selectedResultIndex, selectResult]);

  const previousResult = useCallback(() => {
    if (results.length === 0) return;
    selectResult(selectedResultIndex - 1);
  }, [results.length, selectedResultIndex, selectResult]);

  const openSearch = useCallback(() => {
    setIsSearchMode(true);
  }, []);

  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  const dismissSearch = useCallback(() => {
    setIsSearchMode(false);
    setSelectedResultIndex(0);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchMode(false);
    setQuery("");
    setHighlightTargetId(null);
    setActiveKeyword(null);
    setSelectedResultIndex(0);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const selectAndDismiss = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, results.length - 1));
      const r = results[clamped];
      if (!r) return;
      setSelectedResultIndex(clamped);
      setHighlightTargetId(r.messageId);
      setScrollTrigger((c) => c + 1);
      setActiveKeyword(query.trim());
      setIsSearchMode(false);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightTargetId(null);
        setActiveKeyword(null);
      }, 3000);
    },
    [results, query],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  return {
    query,
    setQuery,
    isSearchMode,
    openSearch,
    closeSearch,
    dismissSearch,
    results,
    selectedResultIndex,
    selectResult,
    selectAndDismiss,
    nextResult,
    previousResult,
    highlightTargetId,
    scrollTrigger,
    highlightKeyword: activeKeyword || (isSearchMode && query.trim() ? query.trim() : null),
  };
}
