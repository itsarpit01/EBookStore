import { useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { PlusIcon, CloseIcon } from "../components/Icons";
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
          <button
            type="button"
            className="btn btn-soft"
            onClick={handleOpenModal}
          >
            Create Your First Ticket
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
              </div>

              <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "var(--text, #333)", lineHeight: 1.5 }}>
                {t.message}
              </p>

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
                  style={{ borderColor: errors.category ? "#dc2626" : undefined }}
                >
                  <option value="general">General Query</option>
                  <option value="book">Book Issue / Return Problem</option>
                  <option value="payment">Membership & Payment Issue</option>
                  <option value="account">Account Access</option>
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
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}