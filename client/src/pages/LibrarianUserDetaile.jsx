import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { SERVER_URL } from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";

export default function LibrarianUserDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState("issues"); // "issues" | "requests"

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/members/${id}/activity`);
      setData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  if (loading) {
    return <p className="empty">Loading reader history & activity...</p>;
  }

  if (!data || !data.member) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <h3>Reader Not Found</h3>
        <p style={{ color: "var(--muted)", margin: "8px 0 16px" }}>
          Could not retrieve activity records for this account.
        </p>
        <Link to="/librarian/users" className="btn btn-primary">
          ← Back to Reader Accounts
        </Link>
      </div>
    );
  }

  const { member, issues = [], requests = [] } = data;
  const tier = member.membership?.tier || "free";

  const renderTierBadge = () => {
    if (tier === "ultimate") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "3px 10px",
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
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "3px 10px",
          }}
        >
          Premium
        </span>
      );
    }
    return (
      <span className="badge" style={{ fontSize: "0.75rem", padding: "3px 10px" }}>
        Free Plan
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 40 }}>
      {/* Back Button */}
      <div style={{ marginBottom: 18 }}>
        <Link
          to="/librarian/users"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.88rem",
            fontWeight: 700,
            color: "var(--primary)",
            textDecoration: "none",
          }}
        >
          ← Back to Reader Accounts
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h2>Reader Activity: {member.name}</h2>
          <p>Inspect active digital book leases, past reading history, and orders.</p>
        </div>
      </div>

      {/* Reader Profile Summary Card (Wahi same jo popup ke top me tha) */}
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              fontWeight: 800,
              overflow: "hidden",
              border: "2px solid var(--border)",
            }}
          >
            {member.avatar ? (
              <img
                src={member.avatar.startsWith("http") ? member.avatar : `${SERVER_URL}${member.avatar}`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              member.name?.[0]?.toUpperCase() || "R"
            )}
          </div>
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
          {/* Live credits */}
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

          <div>{renderTierBadge()}</div>
        </div>
      </div>

      {/* ── Accordion 1: Current & Past Issues / Leases (Wahi same popup wala accordion) ── */}
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

      {/* ── Accordion 2: Purchase & Borrow Requests (Wahi same popup wala accordion) ── */}
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
    </div>
  );
}