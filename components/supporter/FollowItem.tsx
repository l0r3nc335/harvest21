"use client";

import Link from "next/link";
import { User, Church } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FollowItem as FollowItemType } from "@/types/supporter";

interface FollowItemProps {
  item: FollowItemType;
  onAction?: () => void;
  actionLabel?: string;
  actionVariant?: "primary" | "outline" | "danger";
  showPendingBadge?: boolean;
  showRejectedBadge?: boolean;
}

export function FollowItem({
  item,
  onAction,
  actionLabel,
  actionVariant = "outline",
  showPendingBadge = false,
  showRejectedBadge = false,
}: FollowItemProps) {
  const icon = item.entity_type === 'missionary' ? (
    <User className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
  ) : (
    <Church className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
  );

  const typeBadge = (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-700">
      {item.entity_type === 'missionary' ? 'Missionary' : 'Church'}
    </span>
  );

  const buttonVariant = actionVariant === "outline" || actionVariant === "danger" ? "secondary" : "primary";
  const buttonClassName = actionVariant === "danger" 
    ? "flex-shrink-0 text-xs sm:text-sm !bg-red-600 !text-white hover:!bg-red-700 !border-red-600" 
    : "flex-shrink-0 text-xs sm:text-sm";

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors">
      <div className="flex-shrink-0">
        {item.profile_photo_url ? (
          <img
            src={item.profile_photo_url}
            alt={item.entity_name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-200 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {item.page_url ? (
            <Link
              href={`/${item.page_url}`}
              className="font-semibold text-sm sm:text-base text-zinc-900 hover:text-[#D3AF37] transition-colors"
            >
              {item.entity_name}
            </Link>
          ) : (
            <span className="font-semibold text-sm sm:text-base text-zinc-900">
              {item.entity_name}
            </span>
          )}
          {typeBadge}
        </div>
        <p className="text-xs sm:text-sm text-zinc-600">
          {showPendingBadge && (
            <span className="inline-flex items-center gap-1 text-yellow-600">
              <span className="w-2 h-2 rounded-full bg-yellow-600"></span>
              Awaiting approval
            </span>
          )}
          {showRejectedBadge && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              Request declined
            </span>
          )}
          {!showPendingBadge && !showRejectedBadge && (
            `Following since ${new Date(item.requested_at).toLocaleDateString()}`
          )}
        </p>
      </div>

      {onAction && actionLabel && (
        <Button
          variant={buttonVariant}
          onClick={onAction}
          className={buttonClassName}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

