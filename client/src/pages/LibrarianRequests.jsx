import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { statusBadge } from "./PurchaserRequests";
import Modal from "../components/Modal";
import { SearchIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All Orders" },
  { key: "purchased", label: "Purchases" },
  { key: "rented", label: "Active Rentals" },
  { key: "returned", label: "Returned" },
];

export default function LibrarianRequests() {
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Search & Date Range
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/purchase-requests");
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, tab, startDate, endDate]);

  const filteredRequests = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return requests.filter((r) => {
      const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");
      const isReturned = r.status === "returned";

      // Tab filter
      if (tab === "purchased" && !isPurchase) return false;
      if (tab === "rented" && (isPurchase || isReturned)) return false;
      if (tab === "returned" && !isReturned) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        const matchMember = r.requestedBy?.name?.toLowerCase().includes(q);
        const matchEmail = r.requestedBy?.email?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchMember && !matchEmail) return false;
      }

      // Date Range
      if (startDate || endDate) {
        const d = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        const from = startDate || "1970-01-01";
        const to = endDate || todayStr;
        if (d < from || d > to) return false;
      }
      return true;
    });
  }, [requests, tab, searchQuery, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, page]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Orders & Receipts Console</h2>
          <p>Monitor reader digital purchases, active book rentals, and returned leases.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Date Range Toolbar */}
      <div className="toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div className="search-box" style={{ maxWidth: 260, minWidth: 180, flex: "0 1 260px" }}>
          <SearchIcon size={16} />
          <input
            placeholder="Search book, author, member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--card-bg, #f9fafb)", padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", flexShrink: 0 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>From:</span>
          <input type="date" className="toolbar-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }} />
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>To:</span>
          <input type="date" className="toolbar-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }} />
          {(startDate || endDate) && (
            <button type="button" onClick={() => { setStartDate(""); setEndDate(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading orders...</p>
      ) : filteredRequests.length === 0 ? (
        <p className="empty">No orders found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Reader</th>
                <th>Access Plan</th>
                <th>Order Date</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((r) => {
                const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");

                return (
                  <tr key={r._id}>
                    <td>
                      <strong>{r.title}</strong>
                      <span className="cell-sub">{r.author}</span>
                    </td>
                    <td>
                      <strong>{r.requestedBy?.name || "Reader"}</strong>
                      <span className="cell-sub">{r.requestedBy?.email}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          background: isPurchase ? "#ecfdf5" : "#eef2ff",
                          color: isPurchase ? "#047857" : "#4338ca",
                        }}
                      >
                        {isPurchase ? "Lifetime Purchase" : `${r.digitalPlan?.toUpperCase() || "DIGITAL"} Rental`}
                      </span>
                    </td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      {isPurchase ? (
                        <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.84rem" }}>Lifetime Access</span>
                      ) : (
                        formatDate(r.neededUntil)
                      )}
                    </td>
                    <td>{statusBadge(r)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-soft btn-sm" onClick={() => setSelected(r)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
              <button type="button" className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
              <button type="button" className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 8px" }}>Page {page} of {totalPages}</span>
              <button type="button" className="btn btn-soft btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
              <button type="button" className="btn btn-soft btn-sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
            </div>
          )}
        </div>
      )}

      {/* Order Details & Audit Receipt Modal */}
      {selected && (
        <Modal title="Order Details & Audit" onClose={() => setSelected(null)}>
          <div className="detail-list">
            <p><span>Book Title</span><strong>{selected.title}</strong></p>
            <p><span>Author</span>{selected.author}</p>
            {selected.isbn && <p><span>ISBN</span>{selected.isbn}</p>}
            <p><span>Reader Name</span><strong>{selected.requestedBy?.name || "Reader"}</strong></p>
            <p><span>Reader Email</span>{selected.requestedBy?.email}</p>
            <p><span>Order Type</span><strong>{selected.digitalPlan === "lifetime" || selected.reason?.toLowerCase().includes("lifetime") ? "Lifetime Ownership (Purchase)" : `${selected.digitalPlan?.toUpperCase() || "Digital"} Rental`}</strong></p>
            <p><span>Order Date</span>{formatDate(selected.createdAt)}</p>
            <p><span>Validity</span>{selected.digitalPlan === "lifetime" || selected.reason?.toLowerCase().includes("lifetime") ? "Lifetime Access" : formatDate(selected.neededUntil)}</p>
            <p><span>Payment Details</span><span>{selected.reason || "-"}</span></p>
            <p><span>Status</span>{statusBadge(selected)}</p>
          </div>

          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-soft" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}