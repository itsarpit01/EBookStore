import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import IssueFormModal from "../components/IssueFormModal";
import ReissueModal from "../components/ReissueModal";
import Modal from "../components/Modal";
import { PlusIcon, ReturnIcon, SearchIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "issued", label: "Active Issued" },
  { key: "digital", label: "Digital Access" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
];

export default function LibrarianIssues() {
  const toast = useToast();

  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [toReturn, setToReturn] = useState(null);
  const [toReissue, setToReissue] = useState(null);
  const [returning, setReturning] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (tab && tab !== "digital") {
        params.status = tab;
      }
      const res = await api.get("/issues", { params });
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleIssued = () => {
    setShowForm(false);
    loadIssues();
  };

  const handleReissued = () => {
    setToReissue(null);
    loadIssues();
  };

  const confirmReturn = async () => {
    setReturning(true);
    try {
      const res = await api.patch(`/issues/${toReturn._id}/return`);
      const fine = res.data.fine ?? res.data.currentFine ?? 0;
      toast.success(fine > 0 ? `Book returned. Fine: Rs. ${fine}` : "Book returned successfully");
      setToReturn(null);
      loadIssues();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToReturn(null);
    } finally {
      setReturning(false);
    }
  };

  const statusBadge = (i) => {
    if (i.status === "returned") return <span className="badge badge-success">Returned</span>;
    if (i.accessMode === "digital") {
      return (
        <span
          className="badge"
          style={{
            background: "#ecfdf5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
            fontWeight: 700,
          }}
        >
          Digital Active
        </span>
      );
    }
    if (i.isOverdue) return <span className="badge badge-danger">Overdue</span>;
    return <span className="badge badge-warning">Issued</span>;
  };

  // Filter by Tab and Search
  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      // Tab filter
      if (tab === "digital" && i.accessMode !== "digital") return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = i.book?.title?.toLowerCase().includes(q);
        const matchMember = i.member?.name?.toLowerCase().includes(q) || i.member?.email?.toLowerCase().includes(q);
        const matchMode = i.accessMode?.toLowerCase().includes(q) || i.digitalPlan?.toLowerCase().includes(q);
        if (!matchTitle && !matchMember && !matchMode) return false;
      }

      return true;
    });
  }, [issues, tab, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Issue & Digital Lending Records</h2>
          <p>Track all physical copies and active digital access durations per member.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          <PlusIcon size={18} /> Issue physical book
        </button>
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
        <div style={{ position: "relative", minWidth: 240 }}>
          <input
            type="text"
            placeholder="Search book, member, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "7px 10px 7px 32px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
              width: "100%",
            }}
          />
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
            <SearchIcon size={15} />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading records...</p>
      ) : filteredIssues.length === 0 ? (
        <p className="empty">No issue records found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Access Type</th>
                <th>Member</th>
                <th>Issued On</th>
                <th>Duration / Due</th>
                <th>Status</th>
                <th>Fine</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((i) => {
                const isDigital = i.accessMode === "digital";
                const isLifetime = i.digitalPlan === "lifetime";

                return (
                  <tr key={i._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{i.book?.title || "Unknown Book"}</div>
                      <span className="cell-sub">{i.book?.author || "Unknown Author"}</span>
                    </td>

                    <td>
                      {isDigital ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#ecfdf5",
                            color: "#065f46",
                            border: "1px solid #a7f3d0",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                          </svg>
                          Digital ({i.digitalPlan ? i.digitalPlan.toUpperCase() : "PASS"})
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#eef2ff",
                            color: "#3730a3",
                            border: "1px solid #c7d2fe",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                          }}
                        >
                          Physical Copy
                        </span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 500 }}>{i.member?.name || "Member"}</div>
                      <span className="cell-sub">{i.member?.email}</span>
                    </td>

                    <td>{formatDate(i.issueDate)}</td>

                    <td>
                      {isLifetime ? (
                        <span
                          style={{
                            color: "#059669",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            background: "#f0fdf4",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          Lifetime Access
                        </span>
                      ) : (
                        <div>
                          <div>{formatDate(i.dueDate)}</div>
                          {i.reissueCount > 0 && (
                            <span className="cell-sub">Reissued {i.reissueCount}x</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td>{statusBadge(i)}</td>

                    <td>
                      {isDigital ? (
                        <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>N/A (Digital)</span>
                      ) : i.currentFine > 0 ? (
                        <strong style={{ color: "var(--danger, #e53935)" }}>Rs. {i.currentFine}</strong>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {i.status === "issued" && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {!isDigital && (
                            <>
                              {i.canReissue && (
                                <button className="btn btn-soft btn-sm" onClick={() => setToReissue(i)}>
                                  Reissue
                                </button>
                              )}
                              <button className="btn btn-soft btn-sm" onClick={() => setToReturn(i)}>
                                <ReturnIcon size={16} /> Return
                              </button>
                            </>
                          )}
                          {isDigital && (
                            <span style={{ fontSize: "0.76rem", color: "#64748b", fontStyle: "italic" }}>
                              Self-managed
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <IssueFormModal onClose={() => setShowForm(false)} onSaved={handleIssued} />}

      {toReissue && (
        <ReissueModal
          issue={toReissue}
          mode="direct"
          onClose={() => setToReissue(null)}
          onSaved={handleReissued}
        />
      )}

      {toReturn && (
        <Modal title="Return book" onClose={() => setToReturn(null)}>
          <p>
            Mark <strong>{toReturn.book?.title}</strong> as returned by <strong>{toReturn.member?.name}</strong>?
          </p>
          {toReturn.currentFine > 0 && (
            <p style={{ marginTop: 10 }}>
              <span className="badge badge-danger">Late fine: Rs. {toReturn.currentFine}</span>
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToReturn(null)}>
              Cancel
            </button>
            <button className="btn" onClick={confirmReturn} disabled={returning}>
              {returning ? "Returning..." : "Confirm return"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}