"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface FollowerCardProps {
  follower: {
    id: number;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
  };
  displayName: string;
  displayEmail: string;
  profilePhotoUrl?: string | null;
  pageUrl?: string | null;
  note?: string | null;
  isProcessing: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

export function FollowerCard({
  follower,
  displayName,
  displayEmail,
  profilePhotoUrl,
  pageUrl,
  note,
  isProcessing,
  onAccept,
  onReject,
}: FollowerCardProps) {
  const getStatusBadge = () => {
    switch (follower.status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:shadow-md dark:hover:bg-zinc-750 transition-all">
      <div className="shrink-0">
        {profilePhotoUrl ? (
          <img
            src={profilePhotoUrl}
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
            <User className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {pageUrl ? (
            <Link
              href={`/${pageUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-white hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors cursor-pointer truncate"
            >
              {displayName}
            </Link>
          ) : (
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-white truncate">
              {displayName}
            </h3>
          )}
          {getStatusBadge()}
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 truncate">
          {displayEmail}
        </p>
        {note && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic line-clamp-2">
            &ldquo;{note}&rdquo;
          </p>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
          {new Date(follower.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
      </div>

      <div className="shrink-0">
        {follower.status === "pending" && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={onAccept}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white min-w-[80px]"
              data-cy="button-approve-follow"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Accept"
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onReject}
              disabled={isProcessing}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 min-w-[80px]"
              data-cy="button-reject-follow"
            >
              Reject
            </Button>
          </div>
        )}
        {follower.status === "accepted" && onReject && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onReject}
            disabled={isProcessing}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Remove
          </Button>
        )}
        {follower.status === "rejected" && onAccept && (
          <Button
            size="sm"
            variant="primary"
            onClick={onAccept}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Accept"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
