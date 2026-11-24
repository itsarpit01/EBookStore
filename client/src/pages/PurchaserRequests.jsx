import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import Modal from "../components/Modal";
import { SearchIcon } from "../components/Icons";

// Exported for LibrarianRequests.jsx compatibility
export const statusBadge = (status) => {
  const cls = {
    pending: "badge-warning",
    counter_offered: "badge-warning",
    approved: "badge-success",
    rejected: "badge-danger",
    returned: "badge",
  }[status] || "badge";

  const label = status === "counter_offered" ? "Counter Offered" : status;
  return <span className={`badge ${cls}`} style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}>{label}</span>;
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

  // Date Range (From - To)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state (8 items per page)
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

    const handleQuotaUpdate = () => {
      load();
    };
    window.addEventListener("quota-updated", handleQuotaUpdate);
    return () => window.removeEventListener("quota-updated", handleQuotaUpdate);
  }, [load]);

  // Reset page to 1 whenever search or filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, startDate, endDate]);

  // Check if a request record is returned
  const isRequestReturned = (r) => {
    const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");
    if (isPurchase) return false;

    if (r.status === "returned" || r.issue?.status === "returned") return true;

    // Match with user's issue records
    const linkedIssue = myIssues.find(
      (i) =>
        String(i._id) === String(r.issue?._id || r.issue) ||
        String(i.book?._id || i.book) === String(r.book?._id || r.book)
    );

    if (linkedIssue) {
      return linkedIssue.status === "returned";
    }

    if (r.neededUntil && new Date(r.neededUntil) < new Date()) {
      return true;
    }

    return false;
  };

  // Filtered requests by Tab, Search query & Date Range
  const filteredRequests = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return requests.filter((r) => {
      const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");
      const returned = isRequestReturned(r);

      // Filter by Order Type Tab
      if (statusFilter === "purchased" && !isPurchase) return false;
      if (statusFilter === "rented" && (isPurchase || returned)) return false;
      if (statusFilter === "returned" && !returned) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }

      // Date Range
      if (startDate || endDate) {
        const createdDate = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        const fromDate = startDate || "1970-01-01";
        const toDate = endDate || todayStr;

        if (createdDate < fromDate || createdDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [requests, myIssues, statusFilter, searchQuery, startDate, endDate]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, page]);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const getOrderStatusBadge = (r) => {
    const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");

    if (isPurchase) {
      return (
        <span
          className="badge"
          style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 700 }}
        >
          Purchased
        </span>
      );
    }

    // Check if returned
    if (isRequestReturned(r)) {
      return (
        <span
          className="badge"
          style={{ background: "var(--soft)", color: "var(--muted)", border: "1px solid var(--border)", fontWeight: 700 }}
        >
          Returned
        </span>
      );
    }

    return (
      <span
        className="badge"
        style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", fontWeight: 700 }}
      >
        Rented
      </span>
    );
  };

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
            placeholder="Search by book title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--surface)",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
            From:
          </span>
          <input
            type="date"
            className="toolbar-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Start date"
          />

          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
            To:
          </span>
          <input
            type="date"
            className="toolbar-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Today"
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="End date"
          />

          {(startDate || endDate) && (
            <button
              className="btn btn-soft btn-sm"
              onClick={clearDateRange}
              style={{ padding: "3px 8px", fontSize: "0.75rem", marginLeft: 2 }}
              title="Reset date range"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading your orders...</p>
      ) : filteredRequests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: 16 }}>
            No orders matching your filters.
          </p>
          <Link to="/purchaser/books" className="btn">
            Browse Store to Rent or Buy
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Book Title</th>
                <th style={{ whiteSpace: "nowrap" }}>Order Date</th>
                <th style={{ whiteSpace: "nowrap" }}>Access Plan</th>
                <th style={{ whiteSpace: "nowrap" }}>Valid Until</th>
                <th style={{ whiteSpace: "nowrap" }}>Status</th>
                <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((r) => {
                const isPurchase = r.digitalPlan === "lifetime" || r.reason?.toLowerCase().includes("lifetime");

                return (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      {r.author && (
                        <span className="cell-sub">by {r.author}</span>
                      )}
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
                        <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.84rem" }}>
                          Lifetime Access
                        </span>
                      ) : (
                        formatDate(r.neededUntil)
                      )}
                    </td>

                    <td>{getOrderStatusBadge(r)}</td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => setViewRequest(r)}
                        style={{ whiteSpace: "nowrap", fontSize: "0.78rem", padding: "4px 10px" }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Jump Pagination */}
          {totalPages > 1 && (
            <div
              className="pagination"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                « First
              </button>

              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹ Prev
              </button>

              <span style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 8px" }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next ›
              </button>

              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Last »
              </button>
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
            <p>
              <span>Payment Details</span>
              <span>{viewRequest.reason || "Completed"}</span>
            </p>
            <p><span>Status</span>{getOrderStatusBadge(viewRequest)}</p>
          </div>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setViewRequest(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}