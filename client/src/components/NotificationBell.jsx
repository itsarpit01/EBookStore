import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { BellIcon } from "./Icons";
import { playNotificationSound } from "../utils/sound";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isInitialLoad = useRef(true);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      const newUnread = res.data.unreadCount || 0;

      // Play alert sound when new notification arrives (skip initial mount)
      if (!isInitialLoad.current && newUnread > prevCountRef.current) {
        playNotificationSound();
        window.dispatchEvent(new Event("ticket-updated"));
      }

      // Check user setting before showing desktop pop-up
      const popupsAllowed =
        typeof window !== "undefined" &&
        localStorage.getItem("library_notification_popups") !== "false";

      if (
        popupsAllowed &&
        newUnread > prevCountRef.current &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        const latest = res.data.notifications[0];
        if (latest) {
          new Notification(latest.title, {
            body: latest.message,
            icon: "/favicon.jpeg",
          });
        }
      }

      setUnreadCount(newUnread);
      prevCountRef.current = newUnread;
      isInitialLoad.current = false;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // 4-second live poll for instantaneous updates
    const interval = setInterval(fetchNotifications, 4000);

    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (id, link) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
      if (link) {
        setIsOpen(false);
        navigate(link);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete("/notifications/clear-all");
      setNotifications([]);
      setUnreadCount(0);
      prevCountRef.current = 0;
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      prevCountRef.current = 0;
    } catch {
      // ignore
    }
  };

  return (
    <div className="notification-wrapper" ref={dropdownRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        style={{ position: "relative" }}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              background: "#ef4444",
              color: "#fff",
              borderRadius: "50%",
              width: 16,
              height: 16,
              fontSize: "0.65rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--surface, #fff)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            maxHeight: 420,
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
            display: "flex",
            flexDirection: "column",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border, #f1f5f9)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary, #5c6bc0)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--muted, #666)", fontSize: "0.85rem" }}>
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n._id, n.link)}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    background: n.read ? "transparent" : "var(--soft-2, rgba(92,107,192,0.06))",
                    borderBottom: "1px solid var(--border, #f8fafc)",
                    cursor: n.link ? "pointer" : "default",
                    transition: "background 0.15s ease",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.read ? 500 : 700, fontSize: "0.86rem", color: "var(--text, #111)" }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary, #666)", marginTop: 2, lineHeight: 1.35 }}>
                      {n.message}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotification(e, n._id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted, #999)",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      padding: "0 4px",
                    }}
                    title="Delete notification"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}