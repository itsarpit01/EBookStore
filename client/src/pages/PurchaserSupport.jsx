import { useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { PlusIcon, CloseIcon, TrashIcon } from "../components/Icons";
import ConfirmModal from "../components/ConfirmModal";
import { ticketSchema } from "../schemas/ticketSchema";

const initialForm = { subject: "", category: "general", message: "" };

export default function PurchaserSupport() {
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Deletion state
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      toast.success("Reply posted");
      setReplyInputs((prev) => ({ ...prev, [ticketId]: "" }));
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? res.data : t)));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tickets/my");
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleOpenModal = () => {
    setForm(initialForm);
    setErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setErrors({});
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const result = ticketSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach((issue) => {
        const fieldName = issue.path[0];
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/tickets", result.data);
      toast.success("Support ticket submitted successfully");
      setShowModal(false);
      setForm(initialForm);
      fetchTickets();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      setDeleting(true);
      await api.delete(`/tickets/${ticketToDelete._id}`);
      toast.success("Support concern deleted successfully");
      setTickets((prev) => prev.filter((t) => t._id !== ticketToDelete._id));
      setTicketToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const isFormEmpty = !form.subject.trim() || !form.message.trim();

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Help & Support</h2>
          <p>Submit questions, report issue discrepancies, or reach out to the library staff.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={handleOpenModal}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <PlusIcon size={16} />
          <span>Raise New Concern</span>
        </button>
      </div>

      {loading ? (
        <p className="empty">Loading your support tickets...</p>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p className="empty" style={{ margin: "0 0 16px 0" }}>
            You haven't submitted any support requests yet.
          </p>
          <button type="button" className="btn btn-soft" onClick={handleOpenModal}>
            Submit a Question
          </button>
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
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)" }}>
                    Submitted on {formatDate(t.createdAt)}
                  </span>
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
                    {t.status === "resolved" ? "Resolved" : "Pending Review"}
                  </span>

                  {t.status === "open" && (
                    <button
                      type="button"
                      onClick={() => setTicketToDelete(t)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border, #e5e7eb)",
                        color: "#dc2626",
                        cursor: "pointer",
                        padding: "4px 8px",
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fee2e2";
                        e.currentTarget.style.borderColor = "#dc2626";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "var(--border, #e5e7eb)";
                      }}
                      title="Delete this open concern"
                    >
                      <TrashIcon size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "var(--text, #333)", lineHeight: 1.5 }}>
                {t.message}
              </p>

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
                            alignSelf: isStaff ? "flex-start" : "flex-end",
                            maxWidth: "85%",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isStaff ? "var(--primary, #5c6bc0)" : "var(--text, #111)" }}>
                              {c.sender?.name || (isStaff ? "Library Staff" : "You")}
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

                {/* Reply Form */}
                {t.status === "open" ? (
                  <form onSubmit={(e) => handleSendReply(e, t._id)} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="Type a follow-up reply..."
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
                    This concern has been resolved by staff.
                  </div>
                )}
              </div>

              {t.status === "resolved" && (
                <div
                  style={{
                    background: "rgba(22, 163, 74, 0.06)",
                    border: "1px solid rgba(22, 163, 74, 0.2)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginTop: 12,
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#166534", marginBottom: 4 }}>
                    Staff Resolution ({t.resolvedAt ? formatDate(t.resolvedAt) : "Recently"}):
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#14532d", lineHeight: 1.45 }}>
                    {t.resolutionNote}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Raise New Concern */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <h3>Raise Support Concern</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCloseModal}
                disabled={submitting}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                >
                  <option value="general">General Query</option>
                  <option value="book">Book Issue / Return Discrepancy</option>
                  <option value="payment">Payment & Membership Billing</option>
                  <option value="account">Account Access / Profile</option>
                </select>
                {errors.category && <span className="error-text">{errors.category}</span>}
              </div>

              <div className="field">
                <label htmlFor="subject">Subject / Title</label>
                <input
                  id="subject"
                  name="subject"
                  placeholder="e.g. Return recorded incorrectly for Book ID #104"
                  value={form.subject}
                  onChange={handleChange}
                  style={{ borderColor: errors.subject ? "#dc2626" : undefined }}
                />
                {errors.subject && <span className="error-text">{errors.subject}</span>}
              </div>

              <div className="field">
                <label htmlFor="message">Detailed Description</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  placeholder="Provide all details (dates, book title, or transaction ID) so the librarian can assist you quickly..."
                  value={form.message}
                  onChange={handleChange}
                  style={{ borderColor: errors.message ? "#dc2626" : undefined }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  {errors.message ? (
                    <span className="error-text">{errors.message}</span>
                  ) : (
                    <span className="hint">Minimum 20 characters required.</span>
                  )}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: form.message.length > 1000 ? "#dc2626" : "var(--muted, #666)",
                    }}
                  >
                    {form.message.trim().length} / 1000
                  </span>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={submitting || isFormEmpty}
                  style={{
                    opacity: isFormEmpty ? 0.6 : 1,
                    cursor: isFormEmpty ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Open Ticket */}
      {ticketToDelete && (
        <ConfirmModal
          title="Delete Support Concern"
          message={`Are you sure you want to delete your ticket "${ticketToDelete.subject}"? This action cannot be undone.`}
          confirmText="Delete Concern"
          danger
          loading={deleting}
          onClose={() => setTicketToDelete(null)}
          onConfirm={handleDeleteTicket}
        />
      )}
    </>
  );
}