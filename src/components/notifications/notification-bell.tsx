"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications/actions";
import type { NotificationType } from "@/lib/supabase/types";

// ─── Types ──────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Color dot by notification type. */
const typeDot: Record<NotificationType, string> = {
  proposal_received: "bg-brand-500",
  proposal_accepted: "bg-success-500",
  proposal_rejected: "bg-error-500",
  submission_received: "bg-info-500",
  task_completed: "bg-success-500",
  task_disputed: "bg-warning-500",
};

// ─── Component ──────────────────────────────────────────────────────

/**
 * Notification bell with dropdown.
 *
 * ★ Pattern: Server Component fetches initial data, passes to this
 *   Client Component for interactivity. The dropdown uses a ref for
 *   click-outside detection — no external library needed.
 */
export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ── Click outside to close ──────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // ── Mark single as read ─────────────────────────────────────────
  function handleMarkRead(notificationId: string) {
    const formData = new FormData();
    formData.set("notificationId", notificationId);
    startTransition(async () => {
      await markNotificationRead(formData);
      router.refresh();
    });
  }

  // ── Mark all as read ────────────────────────────────────────────
  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* ── Bell button ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative rounded-lg p-2",
          "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          "transition-colors duration-fast",
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
              "rounded-full bg-error-500 px-1 text-[10px] font-bold text-white",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ───────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-80",
            "rounded-xl border border-border-default bg-surface shadow-lg",
            "animate-in fade-in-0 slide-in-from-top-2",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                No notifications yet
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const content = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3",
                        "transition-colors duration-fast",
                        n.read
                          ? "opacity-60"
                          : "bg-brand-50/50 dark:bg-brand-950/20",
                        n.link && "hover:bg-surface-hover",
                      )}
                    >
                      {/* Type dot */}
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          typeDot[n.type],
                        )}
                      />

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[11px] text-text-tertiary">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>

                      {/* Mark read button */}
                      {!n.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          disabled={isPending}
                          className="mt-1 shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary disabled:opacity-50"
                          aria-label="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );

                  return (
                    <li key={n.id} className="border-b border-border-subtle last:border-0">
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            setOpen(false);
                            if (!n.read) handleMarkRead(n.id);
                          }}
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
