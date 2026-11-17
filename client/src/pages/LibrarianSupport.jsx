import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { CloseIcon, CheckIcon } from "../components/Icons";
import { playNotificationSound } from "../utils/sound";

export default function LibrarianSupport() {
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open"); // "open" | "resolved" | "all"

  // Live real-time tracking
  const isInitialLoad = useRef(true);
  const prevOpenCountRef = useRef(0);

  // Resolve Modal State
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);

  // Threading / Comments State
  const [replyInputs, setReplyInputs] = useState({});
  const [submittingReply, setSubmittingReply] = useState({});

  const handleReplyInputChange = (ticketId, value) => {
    setReplyInputs((prev) => ({ ...prev, [ticketId]: value }));
  };

  const handleSendReply = async (e, ticketId) => {
    e.preventDefault();
    const text = (replyInputs[ticketId] || "").trim();
    if (!text) return;

    try {
      setSubmittingReply((prev) => ({ ...prev, [ticketId]: true }));
      const res = await api.post(`/tickets/${ticketId}/comments`, { message: text });
      toast.success("Reply posted to thread");
      setReplyInputs((prev) => ({ ...prev, [ticketId]: "" }));
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? res.data : t)));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const fetchTickets = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const query = filter !== "all" ? `?status=${filter}` : "";
        const res = await api.get(`/tickets${query}`);
        const data = Array.isArray(res.data) ? res.data : [];

        // Check if a new open ticket has arrived in real-time
        const currentOpenCount = data.filter((t) => t.status === "open").length;
        if (!isInitialLoad.current && filter !== "resolved") {
          if (currentOpenCount > prevOpenCountRef.current) {
            playNotificationSound();
            toast.info("New support concern received from a member!");
          }
        }

        setTickets(data);
        prevOpenCountRef.current = currentOpenCount;
        isInitialLoad.current = false;
      } catch (err) {
        if (!silent) toast.error(getErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, toast]
  );

  useEffect(() => {
    isInitialLoad.current = true;
    fetchTickets(false);

    // Live background polling every 4 seconds (silent = true so no screen flicker)
    const interval = setInterval(() => fetchTickets(true), 4000);

    const onFocus = () => fetchTickets(true);
    window.addEventListener("focus", onFocus);
    window.addEventListener("ticket-updated", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ticket-updated", onFocus);
    };
  }, [fetchTickets]);

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setResolving(true);
      await api.patch(`/tickets/${selectedTicket._id}/resolve`, {
        resolutionNote: resolutionNote.trim(),
      });
      toast.success("Ticket resolved and user notified");
      setSelectedTicket(null);
      setResolutionNote("");
      fetchTickets(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Member Support Desk</h2>
          <p>Review inquiries, resolve member discrepancies, and dispatch resolution updates.</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 20,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setFilter("open")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: filter === "open" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: filter === "open" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          Open ({tickets.filter((t) => t.status === "open").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("resolved")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: filter === "resolved" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: filter === "resolved" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          Resolved
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: filter === "all" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: filter === "all" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          All Tickets
        </button>
      </div>

      {loading ? (
        <p className="empty">Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p className="empty" style={{ margin: 0 }}>
            No support tickets found in this view.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tickets.map((t) => (
            <div
              key={t._id}
              className="card"
              style={{
                borderLeft: t.status === "resolved" ? "4px solid #16a34a" : "4px solid #f59e0b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{t.subject}</h3>
                    <span
                      className="badge"
                      style={{
                        background: "rgba(92, 107, 192, 0.1)",
                        color: "var(--primary, #5c6bc0)",
                        textTransform: "capitalize",
                        fontSize: "0.75rem",
                      }}
                    >
                      {t.category}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary, #666)", marginTop: 4 }}>
                    From: <strong>{t.user?.name || "Member"}</strong> ({t.user?.email}) • Submitted {formatDate(t.createdAt)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    className="badge"
                    style={{
                      background: t.status === "resolved" ? "#dcfce7" : "#fef3c7",
                      color: t.status === "resolved" ? "#166534" : "#92400e",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      fontSize: "0.72rem",
                      padding: "3px 10px",
                    }}
                  >
                    {t.status === "resolved" ? "Resolved" : "Open"}
                  </span>

                  {t.status === "open" && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setSelectedTicket(t);
                        setResolutionNote("");
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <CheckIcon size={14} />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Initial Concern Description */}
              <div
                style={{
                  background: "var(--soft-2, rgba(0,0,0,0.02))",
                  border: "1px solid var(--border, #f1f5f9)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  color: "var(--text, #333)",
                }}
              >
                {t.message}
              </div>

              {/* Discussion Thread */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border, #f1f5f9)" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text, #111)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Discussion Thread</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)", fontWeight: 500 }}>
                    ({t.comments?.length || 0} {t.comments?.length === 1 ? "reply" : "replies"})
                  </span>
                </div>

                {/* Comment Bubbles */}
                {t.comments && t.comments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    {t.comments.map((c) => {
                      const isStaff = c.senderRole === "librarian";
                      return (
                        <div
                          key={c._id || c.createdAt}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: isStaff ? "rgba(92, 107, 192, 0.08)" : "var(--surface, #f9fafb)",
                            border: isStaff ? "1px solid rgba(92, 107, 192, 0.25)" : "1px solid var(--border, #e5e7eb)",
                            alignSelf: isStaff ? "flex-end" : "flex-start",
                            maxWidth: "85%",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isStaff ? "var(--primary, #5c6bc0)" : "var(--text, #111)" }}>
                              {c.sender?.name || (isStaff ? "Library Staff" : "Member")}
                            </span>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontWeight: 600,
                                background: isStaff ? "var(--primary, #5c6bc0)" : "#e2e8f0",
                                color: isStaff ? "#fff" : "#475569",
                                textTransform: "uppercase",
                              }}
                            >
                              {c.senderRole}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary, #888)" }}>
                              {formatDate(c.createdAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.86rem", color: "var(--text, #222)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                            {c.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply Form (Active when ticket is open) */}
                {t.status === "open" ? (
                  <form onSubmit={(e) => handleSendReply(e, t._id)} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="Type a reply to this member's concern..."
                      value={replyInputs[t._id] || ""}
                      onChange={(e) => handleReplyInputChange(t._id, e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-sm"
                      disabled={submittingReply[t._id] || !replyInputs[t._id]?.trim()}
                    >
                      {submittingReply[t._id] ? "Sending..." : "Reply"}
                    </button>
                  </form>
                ) : (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary, #666)", fontStyle: "italic", marginTop: 4 }}>
                    This concern is marked as resolved. The discussion thread is archived.
                  </div>
                )}
              </div>

              {t.status === "resolved" && (
                <div
                  style={{
                    background: "rgba(22, 163, 74, 0.05)",
                    border: "1px solid rgba(22, 163, 74, 0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 12,
                    fontSize: "0.85rem",
                  }}
                >
                  <strong style={{ color: "#166534" }}>Staff Resolution Note: </strong>
                  <span style={{ color: "#14532d" }}>{t.resolutionNote}</span>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)", marginTop: 4 }}>
                    Resolved by {t.resolvedBy?.name || "Staff"} on {formatDate(t.resolvedAt)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Resolve Concern */}
      {selectedTicket && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <h3>Resolve Member Concern</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedTicket(null)}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} noValidate>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>Ticket:</div>
                <strong style={{ fontSize: "0.95rem" }}>{selectedTicket.subject}</strong>
                <div style={{ fontSize: "0.82rem", color: "var(--muted, #666)", marginTop: 2 }}>
                  Raised by: {selectedTicket.user?.name} ({selectedTicket.user?.email})
                </div>
              </div>

              <div className="field">
                <label htmlFor="resolutionNote">Resolution Note / Reply to Member</label>
                <textarea
                  id="resolutionNote"
                  name="resolutionNote"
                  rows={4}
                  placeholder="e.g. Verified payment transaction and activated your subscription. Issue is resolved."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setSelectedTicket(null)}
                  disabled={resolving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={resolving || !resolutionNote.trim()}
                >
                  {resolving ? "Resolving..." : "Confirm & Resolve Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}