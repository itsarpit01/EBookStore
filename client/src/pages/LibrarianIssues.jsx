import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { SearchIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All Leases" },
  { key: "active", label: "Active Rentals" },
  { key: "lifetime", label: "Lifetime Purchases" },
  { key: "returned", label: "Expired / Returned" },
];

export default function LibrarianIssues() {
  const toast = useToast();

  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/issues");
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadIssues();

    const onQuotaUpdated = () => loadIssues();
    window.addEventListener("quota-updated", onQuotaUpdated);
    return () => window.removeEventListener("quota-updated", onQuotaUpdated);
  }, [loadIssues]);

  const statusBadge = (i) => {
    const isLifetime = i.digitalPlan === "lifetime";
    const isReturned = i.status === "returned" || (i.dueDate && new Date(i.dueDate) < new Date() && !isLifetime);

    if (isLifetime) {
      return (
        <span
          className="badge"
          style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 700 }}
        >
          Lifetime Owned
        </span>
      );
    }

    if (isReturned) {
      return (
        <span
          className="badge"
          style={{ background: "var(--soft)", color: "var(--muted)", border: "1px solid var(--border)", fontWeight: 600 }}
        >
          Expired / Returned
        </span>
      );
    }

    return (
      <span
        className="badge"
        style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", fontWeight: 700 }}
      >
        Active Rental
      </span>
    );
  };

  // Filter by Tab and Search
  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      const isLifetime = i.digitalPlan === "lifetime";
      const isReturned = i.status === "returned" || (i.dueDate && new Date(i.dueDate) < new Date() && !isLifetime);

      if (tab === "active" && (isLifetime || isReturned)) return false;
      if (tab === "lifetime" && !isLifetime) return false;
      if (tab === "returned" && !isReturned) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = i.book?.title?.toLowerCase().includes(q);
        const matchMember = i.member?.name?.toLowerCase().includes(q) || i.member?.email?.toLowerCase().includes(q);
        const matchPlan = i.digitalPlan?.toLowerCase().includes(q);
        if (!matchTitle && !matchMember && !matchPlan) return false;
      }

      return true;
    });
  }, [issues, tab, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Active Readers & Digital Leases</h2>
          <p>Monitor member active reading passes, rental lease expirations, and access history.</p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
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

        {/* Quick Search Bar */}
        <div style={{ position: "relative", minWidth: 260 }}>
          <input
            type="text"
            placeholder="Search book, reader name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px 8px 34px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "0.85rem",
              width: "100%",
            }}
          />
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
            <SearchIcon size={15} />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading digital lease records...</p>
      ) : filteredIssues.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)" }}>
            No reading lease records found matching your filters.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Reader / Member</th>
                <th>Access Plan</th>
                <th>Acquired On</th>
                <th>Lease Expiry / Validity</th>
                <th style={{ textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((i) => {
                const isLifetime = i.digitalPlan === "lifetime";

                return (
                  <tr key={i._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{i.book?.title || "Book Title"}</div>
                      <span className="cell-sub">{i.book?.author || "Author"}</span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600 }}>{i.member?.name || "Reader"}</div>
                      <span className="cell-sub">{i.member?.email}</span>
                    </td>

                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: isLifetime ? "#ecfdf5" : "#eef2ff",
                          color: isLifetime ? "#065f46" : "#4338ca",
                          border: isLifetime ? "1px solid #a7f3d0" : "1px solid #c7d2fe",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                        }}
                      >
                        {isLifetime ? "LIFETIME PURCHASE" : `${i.digitalPlan ? i.digitalPlan.toUpperCase() : "WEEK"} RENTAL`}
                      </span>
                    </td>

                    <td>{formatDate(i.issueDate)}</td>

                    <td>
                      {isLifetime ? (
                        <span
                          style={{
                            color: "#059669",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                          }}
                        >
                          Permanent (Lifetime)
                        </span>
                      ) : (
                        <div>
                          <div>{formatDate(i.dueDate)}</div>
                          {i.reissueCount > 0 && (
                            <span className="cell-sub">Extended {i.reissueCount}x</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>{statusBadge(i)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}