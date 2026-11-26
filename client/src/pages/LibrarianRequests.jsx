import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import Modal from "../components/Modal";
import { CheckIcon, XIcon, SearchIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All Orders" },
  { key: "purchased", label: "Purchased (Lifetime)" },
  { key: "rented", label: "Active Rentals" },
  { key: "returned", label: "Returned" },
];

export function getOrderBadge(r) {
  if (r.status === "returned") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: 700,
          background: "var(--soft)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
        }}
      >
        Returned
      </span>
    );
  }

  // Check if it's a lifetime purchase or rental
  const isLifetime = r.isPurchased || !r.neededUntil || r.plan === "lifetime";

  if (isLifetime) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: 700,
          background: "rgba(16, 185, 129, 0.12)",
          color: "#10b981",
          border: "1px solid rgba(16, 185, 129, 0.3)",
        }}
      >
        Purchased
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 700,
        background: "rgba(99, 102, 241, 0.12)",
        color: "#6366f1",
        border: "1px solid rgba(99, 102, 241, 0.3)",
      }}
    >
      Rented
    </span>
  );
}

export default function LibrarianRequests() {
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  // Selected order for view modal
  const [selected, setSelected] = useState(null);

  // Search & Date Range
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State (8 items per page)
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/requests");
      setRequests(res.data);
    } catch {
      toast.error("Failed to load digital book orders");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset to page 1 whenever tab, search, or date filter changes
  useEffect(() => {
    setPage(1);
  }, [tab, searchQuery, startDate, endDate]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      // Tab Filtering
      if (tab === "purchased") {
        const isLifetime = r.isPurchased || !r.neededUntil || r.plan === "lifetime";
        if (r.status === "returned" || !isLifetime) return false;
      } else if (tab === "rented") {
        const isLifetime = r.isPurchased || !r.neededUntil || r.plan === "lifetime";
        if (r.status === "returned" || isLifetime) return false;
      } else if (tab === "returned") {
        if (r.status !== "returned") return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const bookTitle = r.book?.title?.toLowerCase() || "";
        const bookAuthor = r.book?.author?.toLowerCase() || "";
        const userName = r.user?.name?.toLowerCase() || "";
        const userEmail = r.user?.email?.toLowerCase() || "";

        if (
          !bookTitle.includes(q) &&
          !bookAuthor.includes(q) &&
          !userName.includes(q) &&
          !userEmail.includes(q)
        ) {
          return false;
        }
      }

      // Date Range Filter
      if (startDate) {
        const reqDate = new Date(r.requestDate);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (reqDate < start) return false;
      }
      if (endDate) {
        const reqDate = new Date(r.requestDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (reqDate > end) return false;
      }

      return true;
    });
  }, [requests, tab, searchQuery, startDate, endDate]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Digital Orders & Access Leases</h1>
          <p className="page-subtitle">
            View reader lifetime purchases, active digital rentals, and returned e-books.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(t.key)}
            style={{ borderRadius: 20, padding: "6px 16px" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="filter-bar"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 20,
          background: "var(--card)",
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <SearchIcon
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Search book, author, member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 36, width: "100%", height: 38 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
            From:
          </span>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: "auto", height: 38 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
            To:
          </span>
          <input
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: "auto", height: 38 }}
          />
        </div>

        {(searchQuery || startDate || endDate) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery("");
              setStartDate("");
              setEndDate("");
            }}
            style={{ height: 38 }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="loading-state">Loading digital order records...</div>
      ) : paginatedRequests.length === 0 ? (
        <div className="empty-state">
          <h3>No digital orders found</h3>
          <p>No transactions match your selected filter criteria.</p>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <table className="table">
            <thead>
              <tr>
                <th>BOOK</th>
                <th>READER</th>
                <th>ACCESS PLAN</th>
                <th>VALID UNTIL</th>
                <th>ORDER DATE</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((r) => {
                const userTier = getEffectiveTier(r.user);
                const isLifetime = r.isPurchased || !r.neededUntil || r.plan === "lifetime";
                const planLabel = isLifetime
                  ? "Lifetime Purchase"
                  : r.plan
                  ? `${r.plan.toUpperCase()} Rental`
                  : "Rental Access";

                return (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--text)" }}>
                        {r.book?.title || "Unknown Book"}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {r.book?.author || "Unknown Author"}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{r.user?.name || "Reader"}</span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "1px 6px",
                            borderRadius: 6,
                            background: "var(--soft)",
                            border: "1px solid var(--border)",
                            fontWeight: 700,
                          }}
                        >
                          {userTier.name.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {r.user?.email}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: isLifetime ? "rgba(16, 185, 129, 0.08)" : "rgba(99, 102, 241, 0.08)",
                          color: isLifetime ? "#10b981" : "#6366f1",
                        }}
                      >
                        {planLabel}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {isLifetime ? (
                        <span style={{ color: "#10b981" }}>Lifetime Access</span>
                      ) : (
                        formatDate(r.neededUntil)
                      )}
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {formatDate(r.requestDate)}
                    </td>
                    <td>{getOrderBadge(r)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelected(r)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} orders
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <div style={{ display: "flex", alignItems: "center", padding: "0 10px", fontSize: "0.85rem", fontWeight: 600 }}>
              Page {page} of {totalPages}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selected && (
        <Modal
          title="Digital Order Details"
          onClose={() => setSelected(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Book Title</div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{selected.book?.title}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>by {selected.book?.author}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Reader</div>
                <div style={{ fontWeight: 600 }}>{selected.user?.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{selected.user?.email}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Access Mode</div>
                <div style={{ fontWeight: 600 }}>Digital E-Book Access</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {selected.paymentMethod === "razorpay" ? "Razorpay Online" : "Reading Credits"}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Validity / Expiry</div>
                <div style={{ fontWeight: 600 }}>
                  {selected.isPurchased || !selected.neededUntil
                    ? "Lifetime Access"
                    : formatDate(selected.neededUntil)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Status</div>
                <div style={{ marginTop: 4 }}>{getOrderBadge(selected)}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}