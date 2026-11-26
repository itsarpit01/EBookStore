import { useEffect, useState, useRef, useCallback } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import api, { SERVER_URL } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";
import MembershipModal from "./MembershipModal";
import ThemeToggle from "./ThemeToggle";
import { getEffectiveTier } from "../utils/membershipConfig";
import { BookIcon, DashboardIcon, IssueIcon, RequestIcon, LogoutIcon, MenuIcon } from "./Icons";

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
        { to: "/librarian/users", label: "Registered Readers", icon: UsersNavIcon },
      ],
    },
  ],
  purchaser: [
    {
      title: "Store",
      items: [
        { to: "/purchaser", label: "Explore Store", icon: BookIcon, end: true },
        { to: "/purchaser/home", label: "My Reading Hub", icon: DashboardIcon },
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [activeRentalCount, setActiveRentalCount] = useState(0);

  const dropdownRef = useRef(null);
  const tier = getEffectiveTier(user);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchActiveCount = useCallback(async () => {
    if (user?.role !== "purchaser") return;
    try {
      const res = await api.get("/issues/my");
      const active = (res.data || []).filter(
        (i) => i.status === "issued" || i.status === "reissue_requested"
      );
      setActiveRentalCount(active.length);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    fetchActiveCount();
  }, [fetchActiveCount]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const sections = NAV_SECTIONS[user?.role] || [];
  const avatarUrl = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${SERVER_URL}${user.avatar}`
    : null;

  return (
    <div className="layout">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Link
            to={user?.role === "librarian" ? "/librarian" : "/purchaser"}
            style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 10 }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
              }}
            >
              <BookIcon size={20} />
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.02em" }}>
                ReadHub
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Digital E-Book Store
              </div>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {sections.map((sec, idx) => (
            <div key={idx} className="sidebar-section">
              <div className="sidebar-section-title">{sec.title}</div>
              {sec.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: User Quota Badge */}
        {user?.role === "purchaser" && (
          <div style={{ padding: "16px", borderTop: "1px solid var(--border)", margin: "0 8px" }}>
            <div
              style={{
                background: "var(--soft)",
                borderRadius: 12,
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  flexShrink: 0,
                }}
              >
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.name || "Reader"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                  {tier.name} • {activeRentalCount}/{tier.maxBooks} Rentals
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <span>{activeRentalCount} active</span>
              <span>{Math.max(0, tier.maxBooks - activeRentalCount)} slot(s) left</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="btn btn-icon sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle Navigation"
            >
              <MenuIcon size={20} />
            </button>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Digital Reading Universe
            </span>
          </div>

          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />

            {/* LIVE CREDITS PILL FOR READERS */}
            {user?.role === "purchaser" && (
              <div
                title="Your available digital reading credits"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: "999px",
                  background: "var(--soft)",
                  border: "1px solid var(--border)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: "0.95rem" }}>🪙</span>
                <span>{user?.credits ?? 100} Credits</span>
              </div>
            )}

            {/* MEMBERSHIP PASS BADGE BUTTON */}
            {user?.role === "purchaser" && (
              <button
                onClick={() => setMembershipOpen(true)}
                className="btn btn-sm"
                style={{
                  background: tier.key === "free" ? "var(--soft)" : "rgba(124, 58, 237, 0.1)",
                  color: tier.key === "free" ? "var(--text)" : "var(--primary)",
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {tier.badge} Pass {tier.key === "free" ? "(Upgrade)" : ""}
              </button>
            )}

            {/* USER PROFILE DROPDOWN */}
            <div className="profile-dropdown" ref={dropdownRef}>
              <button
                className="avatar-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="User Menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.name} className="avatar-img" />
                ) : (
                  <div className="avatar-fallback">
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <div className="dropdown-name">{user?.name}</div>
                    <div className="dropdown-email">{user?.email}</div>
                  </div>
                  <div className="dropdown-divider" />
                  <Link
                    to="/profile"
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile Settings
                  </Link>
                  <button
                    className="dropdown-item text-danger"
                    onClick={() => {
                      setDropdownOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <LogoutIcon size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {membershipOpen && (
        <MembershipModal onClose={() => setMembershipOpen(false)} />
      )}

      {showLogoutConfirm && (
        <ConfirmModal
          title="Sign Out"
          message="Are you sure you want to end your current reading session?"
          confirmText="Log Out"
          variant="danger"
          onConfirm={handleLogout}
          onClose={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}