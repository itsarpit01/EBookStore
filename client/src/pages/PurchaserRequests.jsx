import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import Modal from "../components/Modal";
import { SearchIcon } from "../components/Icons";

// ── Shared Status Badge for Purchaser & Librarian Panels ──
export const statusBadge = (r) => {
  if (!r) return null;

  // Agar object pass hua hai
  if (typeof r === "object") {
    if (r.status === "returned") {
      return (
        <span className="badge" style={{ background: "var(--soft)", color: "var(--muted)", border: "1px solid var(--border)", fontWeight: 700 }}>
          Returned
        </span>
      );
    }

    const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");
    if (isPurchase || r.status === "purchased") {
      return (
        <span className="badge" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 700 }}>
          Purchased
        </span>
      );
    }

    if (r.status === "approved" || r.accessMode === "digital" || r.digitalPlan) {
      return (
        <span className="badge" style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", fontWeight: 700 }}>
          Rented
        </span>
      );
    }

    if (r.status === "pending") return <span className="badge badge-warning">Pending</span>;
    if (r.status === "rejected") return <span className="badge badge-danger">Rejected</span>;
    return <span className="badge" style={{ textTransform: "capitalize" }}>{r.status}</span>;
  }

  // Fallback agar string pass hui ho
  if (r === "returned") return <span className="badge" style={{ background: "var(--soft)", color: "var(--muted)", border: "1px solid var(--border)", fontWeight: 700 }}>Returned</span>;
  if (r === "approved") return <span className="badge" style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", fontWeight: 700 }}>Rented</span>;
  const cls = { pending: "badge-warning", rejected: "badge-danger" }[r] || "badge";
  return <span className={`badge ${cls}`} style={{ textTransform: "capitalize" }}>{r}</span>;
};

export default function PurchaserRequests() {
  const { user } = useAuth();
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [myIssues, setMyIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search Toolbar
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const [viewRequest, setViewRequest] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, issueRes] = await Promise.all([
        api.get("/purchase-requests/my"),
        api.get("/issues/my").catch(() => ({ data: [] })),
      ]);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
      setMyIssues(Array.isArray(issueRes.data) ? issueRes.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const handleQuotaUpdate = () => load();
    window.addEventListener("quota-updated", handleQuotaUpdate);
    return () => window.removeEventListener("quota-updated", handleQuotaUpdate);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, startDate, endDate]);

  const isRequestReturned = (r) => {
    const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");
    if (isPurchase) return false;
    if (r.status === "returned" || r.issue?.status === "returned") return true;

    const linkedIssue = myIssues.find(
      (i) =>
        String(i._id) === String(r.issue?._id || r.issue) ||
        String(i.book?._id || i.book) === String(r.book?._id || r.book)
    );
    if (linkedIssue) return linkedIssue.status === "returned";
    return Boolean(r.neededUntil && new Date(r.neededUntil) < new Date());
  };

  const filteredRequests = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return requests.filter((r) => {
      const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");
      const returned = isRequestReturned(r);

      if (statusFilter === "purchased" && !isPurchase) return false;
      if (statusFilter === "rented" && (isPurchase || returned)) return false;
      if (statusFilter === "returned" && !returned) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }

      if (startDate || endDate) {
        const createdDate = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        const fromDate = startDate || "1970-01-01";
        const toDate = endDate || todayStr;
        if (createdDate < fromDate || createdDate > toDate) return false;
      }

      return true;
    });
  }, [requests, myIssues, statusFilter, searchQuery, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, page]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Orders & Receipts</h2>
          <p>Track your digital e-book purchases, rental orders, and receipts.</p>
        </div>
        <Link to="/purchaser/books" className="btn">
          Explore Store
        </Link>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[
            { key: "", label: "All Orders" },
            { key: "purchased", label: "Purchases" },
            { key: "rented", label: "Active Rentals" },
            { key: "returned", label: "Returned" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab ${statusFilter === t.key ? "active" : ""}`}
              onClick={() => setStatusFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="toolbar-input"
            placeholder="Search by book title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>From:</span>
          <input type="date" className="toolbar-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }} />
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>To:</span>
          <input type="date" className="toolbar-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }} />
          {(startDate || endDate) && (
            <button className="btn btn-soft btn-sm" onClick={() => { setStartDate(""); setEndDate(""); }} style={{ padding: "3px 8px", fontSize: "0.75rem" }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading your orders...</p>
      ) : filteredRequests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: 16 }}>No orders matching your filters.</p>
          <Link to="/purchaser/books" className="btn">Browse Store to Rent or Buy</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Order Date</th>
                <th>Access Plan</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((r) => {
                const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");

                return (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      {r.author && <span className="cell-sub">by {r.author}</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>
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
                    <td style={{ whiteSpace: "nowrap" }}>
                      {isPurchase ? (
                        <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.84rem" }}>Lifetime Access</span>
                      ) : (
                        formatDate(r.neededUntil)
                      )}
                    </td>
                    <td>{statusBadge(r)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => setViewRequest(r)}
                        style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                      >
                        View Details
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

      {/* View Details / Receipt Modal */}
      {viewRequest && (
        <Modal title="Order Details & Receipt" onClose={() => setViewRequest(null)}>
          <div className="detail-list">
            <p><span>Book Title</span><strong>{viewRequest.title}</strong></p>
            <p><span>Author</span>{viewRequest.author || "-"}</p>
            {viewRequest.isbn && <p><span>ISBN</span>{viewRequest.isbn}</p>}
            <p>
              <span>Order Type</span>
              <strong>
                {viewRequest.digitalPlan === "lifetime" || viewRequest.reason?.toLowerCase().includes("lifetime")
                  ? "Lifetime Ownership (Purchase)"
                  : `${viewRequest.digitalPlan?.toUpperCase() || "Digital"} Rental`}
              </strong>
            </p>
            <p><span>Order Date</span><span>{formatDate(viewRequest.createdAt)}</span></p>
            <p>
              <span>Validity</span>
              <span>
                {viewRequest.digitalPlan === "lifetime" || viewRequest.reason?.toLowerCase().includes("lifetime")
                  ? "Lifetime Access (No Expiry)"
                  : formatDate(viewRequest.neededUntil)}
              </span>
            </p>
            <p><span>Payment Details</span><span>{viewRequest.reason || "Completed"}</span></p>
            <p><span>Status</span>{statusBadge(viewRequest)}</p>
          </div>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setViewRequest(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}