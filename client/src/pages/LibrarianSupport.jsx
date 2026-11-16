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

        {/* Test Alert Sound Button */}
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => {
            playNotificationSound();
            toast.success("Playing notification alert sound");
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}
          title="Click to verify speaker output and unlock browser audio"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <span>Test Sound</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 10,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setFilter("open")}
          style={{
            padding: "8px 16px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: filter === "open" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: filter === "open" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          Open Concerns {filter === "open" && `(${tickets.length})`}
        </button>

        <button
          type="button"
          onClick={() => setFilter("resolved")}
          style={{
            padding: "8px 16px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: filter === "resolved" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: filter === "resolved" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          Resolved Archive {filter === "resolved" && `(${tickets.length})`}
        </button>

        <button
          type="button"
          onClick={() => setFilter("all")}
          style={{
            padding: "8px 16px",
            border: "none",
            background: "transparent",
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
                <button type="submit" className="btn" disabled={resolving}>
                  {resolving ? "Resolving..." : "Mark as Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}