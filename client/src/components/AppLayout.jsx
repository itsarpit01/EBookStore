import { useEffect, useState, useRef, useCallback } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";
import MembershipModal from "./MembershipModal";
import ThemeToggle from "./ThemeToggle";
import { getEffectiveTier } from "../utils/membershipConfig";
import { BookIcon, DashboardIcon, IssueIcon, RequestIcon, LogoutIcon, MenuIcon } from "./Icons";

const SERVER_URL = "http://localhost:5001";

function WishlistNavIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function UsersNavIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const NAV_SECTIONS = {
  librarian: [
    {
      title: "Store Overview",
      items: [
        { to: "/librarian", label: "Dashboard", icon: DashboardIcon, end: true },
      ],
    },
    {
      title: "Catalog & Sales",
      items: [
        { to: "/librarian/books", label: "Inventory Catalog", icon: BookIcon },
        { to: "/librarian/requests", label: "Orders & Payments", icon: RequestIcon },
        { to: "/librarian/issues", label: "Active Readers", icon: IssueIcon },
      ],
    },
    {
      title: "Administration",
      items: [
        { to: "/librarian/users", label: "Reader Accounts", icon: UsersNavIcon },
      ],
    },
  ],
  purchaser: [
    {
      title: "Store",
      items: [
        { to: "/purchaser/books", label: "Explore Store", icon: BookIcon },
        { to: "/purchaser", label: "My Reading Hub", icon: DashboardIcon, end: true },
      ],
    },
    {
      title: "My Shelf",
      items: [
        { to: "/purchaser/my-issues", label: "My Library", icon: IssueIcon },
        { to: "/purchaser/wishlist", label: "Wishlist", icon: WishlistNavIcon },
        { to: "/purchaser/requests", label: "Orders & Receipts", icon: RequestIcon },
      ],
    },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [activeRentalsCount, setActiveRentalsCount] = useState(0);

  const dropdownRef = useRef(null);

  const sections = NAV_SECTIONS[user?.role] || [];
  const avatarSrc = user?.avatar ? `${SERVER_URL}${user.avatar}` : null;
  const tier = getEffectiveTier(user);

  // Live capacity & active rentals load
  const fetchUserQuota = useCallback(async () => {
    if (user?.role !== "purchaser") return;
    try {
      const res = await api.get("/issues/my");
      const issues = Array.isArray(res.data) ? res.data : [];
      const active = issues.filter((i) => i.status === "issued").length;
      setActiveRentalsCount(active);
    } catch {
      // ignore
    }
  }, [user?.role]);

  useEffect(() => {
    fetchUserQuota();

    const handleQuotaUpdate = () => {
      fetchUserQuota();
    };

    window.addEventListener("quota-updated", handleQuotaUpdate);
    return () => {
      window.removeEventListener("quota-updated", handleQuotaUpdate);
    };
  }, [fetchUserQuota]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [user?.avatar]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setConfirmLogout(false);
    setDropdownOpen(false);
    setOpen(false);
    await logout();
    toast.info("Logged out successfully");
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <div className={`overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="logo">
          <span className="logo-mark">
            <BookIcon size={20} />
          </span>
          <div>
            <div style={{ lineHeight: 1.1, fontSize: "1.15rem", fontWeight: 800 }}>ReadHub</div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Digital E-Book Store
            </div>
          </div>
        </div>

        <nav className="nav" style={{ flex: 1, overflowY: "auto" }}>
          {sections.map((section, idx) => (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* ── User Card with Active Subscription Limit ── */}
        <div
          onClick={() => navigate(`/${user?.role}/profile`)}
          title="View Account & Membership Limits"
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            background: "var(--soft-2)",
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            cursor: "pointer",
            transition: "all 0.2s ease",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "0.84rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>
                {user?.name}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                {user?.role === "librarian" ? (
                  "Store Administrator"
                ) : (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background:
                          tier.tier === "ultimate"
                            ? "#f59e0b"
                            : tier.tier === "premium"
                            ? "#6366f1"
                            : "var(--primary)",
                      }}
                    />
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>
                      {tier.badge} Plan
                    </span>
                    <span>•</span>
                    <span>
                      {tier.maxBooks === Infinity
                        ? "Unlimited"
                        : `${activeRentalsCount}/${tier.maxBooks} Rentals`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Capacity Progress Bar for Readers */}
          {user?.role === "purchaser" && (
            <div style={{ marginTop: 2 }}>
              <div
                style={{
                  height: 4,
                  width: "100%",
                  background: "var(--border)",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width:
                      tier.maxBooks === Infinity
                        ? "100%"
                        : `${Math.min(100, Math.round((activeRentalsCount / tier.maxBooks) * 100))}%`,
                    background:
                      tier.tier === "ultimate"
                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                        : activeRentalsCount >= tier.maxBooks
                        ? "var(--danger)"
                        : "linear-gradient(90deg, var(--primary), #8b5cf6)",
                    borderRadius: 99,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.68rem",
                  color: "var(--muted)",
                  marginTop: 4,
                  fontWeight: 600,
                }}
              >
                <span>
                  {tier.maxBooks === Infinity
                    ? `${activeRentalsCount} active`
                    : `${activeRentalsCount} active`}
                </span>
                <span>
                  {tier.maxBooks === Infinity
                    ? "No Limit"
                    : `${Math.max(0, tier.maxBooks - activeRentalsCount)} slot(s) left`}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Topbar & Content ── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </button>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--muted)" }}>
              {user?.role === "librarian" ? "Admin Console" : "Digital Reading Universe"}
            </div>
          </div>

          <div className="topbar-right">
            <ThemeToggle />

            {/* Pass Upgrade Pill (Reader only) */}
            {user?.role === "purchaser" && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowMembershipModal(true)}
                style={{
                  background:
                    tier.tier === "ultimate"
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : tier.tier === "premium"
                      ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                      : "var(--surface)",
                  color: tier.tier === "free" ? "var(--text)" : "#fff",
                  border: tier.tier === "free" ? "1px solid var(--border)" : "none",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  borderRadius: "999px",
                  padding: "6px 14px",
                }}
              >
                <span>{tier.badge} Pass</span>
                {tier.tier === "free" && <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>(Upgrade)</span>}
              </button>
            )}

            {/* ── User Avatar & Dropdown Menu ── */}
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                title="Account menu"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {avatarSrc && !avatarBroken ? (
                  <img
                    className="avatar"
                    src={avatarSrc}
                    alt=""
                    onError={() => setAvatarBroken(true)}
                    style={{ objectFit: "cover", cursor: "pointer" }}
                  />
                ) : (
                  <span className="avatar" style={{ cursor: "pointer" }}>
                    {user?.name?.[0]?.toUpperCase()}
                  </span>
                )}
              </button>

              {/* Dropdown Panel */}
              {dropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    width: "250px",
                    background: "var(--surface)",
                    borderRadius: "14px",
                    border: "1px solid var(--border)",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.16)",
                    zIndex: 100,
                    overflow: "hidden",
                    animation: "toast-in 0.15s ease-out",
                  }}
                >
                  {/* User Header */}
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", background: "var(--soft-2)" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text)" }}>{user?.name}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user?.email}
                    </div>
                    <span
                      className="badge"
                      style={{
                        marginTop: 6,
                        background: user?.role === "librarian" ? "var(--primary)" : "var(--soft)",
                        color: user?.role === "librarian" ? "#fff" : "var(--primary)",
                      }}
                    >
                      {user?.role === "librarian" ? "Store Administrator" : `${tier.badge} Pass`}
                    </span>
                  </div>

                  {/* Dropdown Links */}
                  <div style={{ padding: "6px" }}>
                    {/* Profile & Info */}
                    <Link
                      to={`/${user?.role}/profile?tab=profile`}
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--soft)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Profile & Account
                    </Link>

                    {/* Store Passes (for readers) */}
                    {user?.role === "purchaser" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          setShowMembershipModal(true);
                        }}
                        style={{
                          width: "100%",
                          background: "none",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: "var(--text)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--soft)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Membership Passes
                      </button>
                    )}

                    {/* Settings & Delete Account */}
                    <Link
                      to={`/${user?.role}/profile?tab=settings`}
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--soft)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Settings & Delete Account
                    </Link>
                  </div>

                  {/* Divider */}
                  <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />

                  {/* Logout Button */}
                  <div style={{ padding: "6px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        setConfirmLogout(true);
                      }}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "var(--danger)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--danger-bg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <LogoutIcon size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {confirmLogout && (
        <ConfirmModal
          title="Sign Out"
          message="Are you sure you want to log out of ReadHub?"
          confirmText="Sign Out"
          danger
          onClose={() => setConfirmLogout(false)}
          onConfirm={handleLogout}
        />
      )}

      {showMembershipModal && (
        <MembershipModal onClose={() => setShowMembershipModal(false)} />
      )}
    </div>
  );
}