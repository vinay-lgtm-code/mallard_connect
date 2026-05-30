"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { rowsToApp } from "@/lib/supabase/mappers";
import { formatRelativeDate } from "@/lib/utils";
import type { Notification } from "@/types";

export function NotificationDropdown() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [notifications, setNotifications] = useState<(Notification & { id: string })[]>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setNotifications(rowsToApp<Notification & { id: string }>(data));
      });
  }, [supabase, user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleNotificationClick(notification: Notification & { id: string }) {
    if (!notification.isRead && supabase) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
      setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, isRead: true } : n));
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0 || !supabase) return;
    const ids = unread.map((n) => n.id);
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 relative"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-[12px] shadow-lg border border-gray-100 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                    !notification.isRead ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-gray-900 ${!notification.isRead ? "font-semibold" : ""}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {notification.body}
                    </p>
                    {notification.createdAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeDate(notification.createdAt)}
                      </p>
                    )}
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                <Check size={14} />
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
