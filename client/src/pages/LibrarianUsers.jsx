import { useCallback, useEffect, useState, useMemo } from "react";
import api, { SERVER_URL } from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { SearchIcon } from "../components/Icons";

function MemberAvatar({ member, size = 34 }) {
  const [broken, setBroken] = useState(false);
  const avatarSrc = member?.avatar
    ? member.avatar.startsWith("http")
      ? member.avatar
      : `${SERVER_URL}${member.avatar}`
    : null;

  if (avatarSrc && !broken) {
    return (
      <img
        src={avatarSrc}
        alt=""
        onError={() => setBroken(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      className="avatar avatar-sm"
      style={{
        width: size,
        height: size,
        fontSize: size <= 34 ? "0.82rem" : "1rem",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {member?.name?.[0]?.toUpperCase() || "R"}
    </span>
  );
}

const TIER_TABS = [
  { key: "", label: "All Plans" },
  { key: "free", label: "Free" },
  { key: "premium", label: "Premium" },
  { key: "ultimate", label: "Ultimate" },
];

export default function LibrarianUsers() {
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent_activity");

  // Pagination (8 members per page)
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  // ── Full Page View State (No Popup Modal!) ──
  const [selectedMember, setSelectedMember] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState("issues"); // "issues" | "requests"

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/users/members");
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMembers();
    const interval = setInterval(loadMembers, 60000);
    return () => clearInterval(interval);
  }, [loadMembers]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, tierFilter, activityFilter, sortBy]);

  // Click View Activity -> Switch to Full Page View
  const openActivity = async (member) => {
    setSelectedMember(member);
    setActiveAccordion("issues");
    setActivityLoading(true);
    try {
      const res = await api.get(`/users/members/${member._id}/activity`);
      setActivityData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActivityLoading(false);
    }
  };

  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchEmail = m.email?.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }

      if (tierFilter && m.membership?.tier !== tierFilter) {
        return false;
      }

      if (activityFilter === "with_books" && m.activeBooksCount <= 0) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "recent_activity") {
        const dateA = new Date(a.lastActivityAt || a.createdAt).getTime();
        const dateB = new Date(b.lastActivityAt || b.createdAt).getTime();
        return dateB - dateA;
      }
      if (sortBy === "joined") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "books") {
        return (b.activeBooksCount || 0) - (a.activeBooksCount || 0);
      }
      return 0;
    });
  }, [members, searchQuery, tierFilter, activityFilter, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedMembers.length / PAGE_SIZE) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAndSortedMembers.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedMembers, page]);

  const totalCount = members.length;
  const paidCount = members.filter((m) => m.membership?.tier && m.membership.tier !== "free").length;
  const borrowingCount = members.filter((m) => (m.activeBooksCount || 0) > 0).length;

  const renderTierBadge = (membership) => {
    const tier = membership?.tier || "free";
    if (tier === "ultimate") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "2px 8px",
          }}
        >
          Ultimate
        </span>
      );
    }
    if (tier === "premium") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #6366f1, #4338ca)",
            color: "#fff",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "2px 8px",
          }}
        >
          Premium
        </span>
      );
    }
    return (
      <span className="badge" style={{ fontSize: "0.72rem" }}>
        Free
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 2: DEDICATED FULL PAGE ACTIVITY VIEW (When a member is selected)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedMember) {
    const member = activityData?.member || selectedMember;
    const issues = activityData?.issues || [];
    const requests = activityData?.requests || [];

    return (
      <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 40 }}>
        {/* Back Button */}
        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setSelectedMember(null);
              setActivityData(null);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              padding: "6px 14px",
            }}
          >
            ← Back to Reader Accounts
          </button>
        </div>

        {/* Page Head */}
        <div className="page-head" style={{ marginBottom: 20 }}>
          <div>
            <h2>Reader Activity: {member.name}</h2>
            <p>Inspect active digital book leases, past reading history, and orders.</p>
          </div>
        </div>

        {activityLoading ? (
          <p className="empty">Loading reader history & activity...</p>
        ) : (
          <>
            {/* Top Reader Summary Card (Popup wala Header) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                background: "var(--card)",
                borderRadius: 14,
                border: "1px solid var(--border)",
                marginBottom: 20,
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <MemberAvatar member={member} size={50} />
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                    {member.name}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 2 }}>
                    {member.email} • Joined on {formatDate(member.createdAt)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "var(--soft)",
                    border: "1px solid var(--border)",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  <span>🪙</span>
                  <span>{member.credits ?? 100} Credits</span>
                </div>

                <div>{renderTierBadge(member.membership)}</div>
              </div>
            </div>

            {/* Accordion 1: Current & Past Issues (Popup wala Accordion) */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                marginBottom: 16,
                overflow: "hidden",
                background: "var(--card)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveAccordion(activeAccordion === "issues" ? "" : "issues")}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: activeAccordion === "issues" ? "var(--soft)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--text)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📖</span>
                  <span>Current & Past Digital Leases ({issues.length})</span>
                </div>
                <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                  {activeAccordion === "issues" ? "▲" : "▼"}
                </span>
              </button>

              {activeAccordion === "issues" && (
                <div style={{ padding: "16px 18px", borderTop: "1px solid var(--border)" }}>
                  {issues.length === 0 ? (
                    <p className="empty" style={{ margin: "12px 0" }}>No digital book issues on record.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Book</th>
                            <th>Acquired / Due</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issues.map((i) => {
                            const isReturned = i.status === "returned";
                            const isOverdue = !isReturned && i.dueDate && new Date(i.dueDate) < new Date();

                            return (
                              <tr key={i._id}>
                                <td>
                                  <strong>{i.book?.title || "Unknown Book"}</strong>
                                  <span className="cell-sub">{i.book?.author}</span>
                                </td>
                                <td>
                                  <div>Acquired: {formatDate(i.issueDate || i.createdAt)}</div>
                                  <span className="cell-sub">
                                    Due: {i.dueDate ? formatDate(i.dueDate) : "Lifetime"}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      isReturned
                                        ? "badge-secondary"
                                        : isOverdue
                                        ? "badge-danger"
                                        : "badge-success"
                                    }`}
                                  >
                                    {isReturned ? "Returned" : isOverdue ? "Expired" : "Active"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 2: Purchase & Borrow Requests (Popup wala Accordion) */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--card)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveAccordion(activeAccordion === "requests" ? "" : "requests")}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: activeAccordion === "requests" ? "var(--soft)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--text)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🛒</span>
                  <span>Purchase & Borrow Requests ({requests.length})</span>
                </div>
                <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                  {activeAccordion === "requests" ? "▲" : "▼"}
                </span>
              </button>

              {activeAccordion === "requests" && (
                <div style={{ padding: "16px 18px", borderTop: "1px solid var(--border)" }}>
                  {requests.length === 0 ? (
                    <p className="empty" style={{ margin: "12px 0" }}>No request records found for this reader.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Book</th>
                            <th>Requested On</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requests.map((r) => (
                            <tr key={r._id}>
                              <td>
                                <strong>{r.title || r.book?.title}</strong>
                                <span className="cell-sub">{r.author || r.book?.author}</span>
                              </td>
                              <td>{formatDate(r.createdAt || r.requestDate)}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    r.status === "approved"
                                      ? "badge-success"
                                      : r.status === "rejected"
                                      ? "badge-danger"
                                      : "badge-warning"
                                  }`}
                                >
                                  {r.status?.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 1: MAIN READERS TABLE VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Reader Accounts</h2>
          <p>Inspect registered readers, reading subscriptions, and digital access activity.</p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Total Readers</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginTop: 4 }}>{totalCount}</div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: "#4f46e5" }}>Active Paid Plans</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#4f46e5", marginTop: 4 }}>
            {paidCount}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>Readers With Active Books</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#16a34a", marginTop: 4 }}>
            {borrowingCount}
          </div>
        </div>
      </div>

      {/* Toolbar with Tier Tabs, Search, Filter, and Sort */}
      <div
        className="toolbar"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TIER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab ${tierFilter === t.key ? "active" : ""}`}
              onClick={() => setTierFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="toolbar-input"
            placeholder="Search reader by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>

        <select
          className="toolbar-input"
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="">All Readers</option>
          <option value="with_books">With Active Books</option>
        </select>

        <select
          className="toolbar-input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ width: "auto", fontWeight: 600 }}
        >
          <option value="recent_activity">Sort: Recent Activity</option>
          <option value="joined">Sort: Recently Joined</option>
          <option value="books">Sort: Most Active Books</option>
        </select>
      </div>

      {/* Members Table */}
      {loading ? (
        <p className="empty">Loading readers...</p>
      ) : filteredAndSortedMembers.length === 0 ? (
        <p className="empty">No readers matching your filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reader</th>
                <th>Membership Tier</th>
                <th>Active Books</th>
                <th>Recent Activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.map((m) => (
                <tr key={m._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <MemberAvatar member={m} size={34} />
                      <div>
                        <strong>{m.name}</strong>
                        <span className="cell-sub">{m.email}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div>{renderTierBadge(m.membership)}</div>
                      {m.membership?.expiresAt && m.membership.tier !== "free" && (
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          Exp: {formatDate(m.membership.expiresAt)}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span
                      className={`badge ${m.activeBooksCount > 0 ? "badge-primary" : "badge-secondary"}`}
                      style={{ fontSize: "0.78rem" }}
                    >
                      {m.activeBooksCount} book(s)
                    </span>
                  </td>

                  <td>
                    <div>
                      <strong>{formatDate(m.lastActivityAt || m.createdAt)}</strong>
                      <span
                        className="cell-sub"
                        style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}
                      >
                        Joined: {formatDate(m.createdAt)}
                      </span>
                    </div>
                  </td>

                  <td>
                    {/* View Activity: Opens full page view */}
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => openActivity(m)}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      View Activity →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18 }}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ‹ Prev
          </button>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 8px" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next ›
          </button>
        </div>
      )}
    </>
  );
}