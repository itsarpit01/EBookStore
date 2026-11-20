import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import MembershipModal from "./MembershipModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { makeRequestFormSchema } from "../schemas/requestSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, toDateInput } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import { statusBadge } from "../pages/PurchaserRequests";

export default function RequestFormModal({ initial = {}, request, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = Boolean(request);

  const lockedId = !isEdit ? initial.bookId || "" : "";
  const isLocked = Boolean(lockedId);

  const tier = getEffectiveTier(user);

  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [myRequests, setMyRequests] = useState([]);
  const [myActiveIssues, setMyActiveIssues] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // ── Step 1 Choice: null / "physical" / "digital" ──
  const [accessMode, setAccessMode] = useState("physical"); // Default physical ya null
  const [paymentMode, setPaymentMode] = useState("credits"); // "credits" ya "cash"
  const [digitalPlan, setDigitalPlan] = useState("week"); // "day", "week", "year", "lifetime"
  const [userCredits, setUserCredits] = useState(100);

  const [form, setForm] = useState({
    bookId: request?.book || initial.bookId || "",
    quantity: request?.quantity ?? 1,
    neededUntil: request?.neededUntil ? toDateInput(request.neededUntil) : dateInput(1),
    reason: request?.reason || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!isEdit) {
          const [reqRes, issueRes, shelfRes] = await Promise.all([
            api.get("/purchase-requests/my"),
            api.get("/issues/my").catch(() => ({ data: [] })),
            api.get("/books/my-digital-shelf").catch(() => ({ data: { credits: 100 } })),
          ]);
          if (!cancelled) {
            setMyRequests(reqRes.data);
            const activeIssues = (Array.isArray(issueRes.data) ? issueRes.data : []).filter(
              (i) => i.status === "issued"
            );
            setMyActiveIssues(activeIssues);
            if (shelfRes.data?.credits !== undefined) {
              setUserCredits(shelfRes.data.credits);
            }
          }
        }

        if (isLocked) {
          const res = await api.get(`/books/${lockedId}`);
          if (!cancelled) setBooks([res.data]);
        } else {
          const res = await api.get("/books", { params: { limit: 50, sort: "title" } });
          if (cancelled) return;
          const list = res.data.data;
          setBooks(list);
          if (request && !request.book && request.isbn) {
            const match = list.find((b) => b.isbn === request.isbn);
            if (match) setForm((f) => ({ ...f, bookId: match._id }));
          }
        }
      } catch (err) {
        if (!cancelled) setFormError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingBooks(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [request, isLocked, lockedId, isEdit]);

  const selected = books.find((b) => b._id === form.bookId);

  // Digital Pricing Map
  const lifetimeCredits = selected?.creditPrice || Math.max(1, Math.round((selected?.price || 100) / 10));
  const digitalPlans = [
    { id: "day", title: "1 Day Pass", inr: selected?.rentalPlans?.day?.inr ?? 20, credits: selected?.rentalPlans?.day?.credits ?? 2, desc: "24 Hours Access" },
    { id: "week", title: "1 Week Pass", inr: selected?.rentalPlans?.week?.inr ?? 70, credits: selected?.rentalPlans?.week?.credits ?? 7, desc: "7 Days Access" },
    { id: "year", title: "1 Year Pass", inr: selected?.rentalPlans?.year?.inr ?? 299, credits: selected?.rentalPlans?.year?.credits ?? 30, desc: "365 Days Access" },
    { id: "lifetime", title: "Lifetime Buy", inr: selected?.price || 499, credits: lifetimeCredits, desc: "Permanent Ownership" },
  ];
  const currentPlan = digitalPlans.find((p) => p.id === digitalPlan) || digitalPlans[1];
  const hasEnoughCredits = userCredits >= currentPlan.credits;

  // Physical Limit Checks
  const activeRequestsCount = myRequests.filter(
    (r) => ["pending", "counter_offered"].includes(r.status)
  ).length;
  const totalActiveUsed = activeRequestsCount + myActiveIssues.length;
  const isLimitReached =
    accessMode === "physical" && !isEdit && tier.maxBooks !== Infinity && totalActiveUsed >= tier.maxBooks;

  const existingActiveRequest =
    accessMode === "physical" && !isEdit && form.bookId
      ? myRequests.find((r) => {
          const isThisBook = r.book === form.bookId || r.book?._id === form.bookId;
          if (!isThisBook) return false;
          if (["pending", "counter_offered"].includes(r.status)) return true;
          if (r.status === "approved") {
            return myActiveIssues.some(
              (i) => i.book?._id === form.bookId || i.book === form.bookId
            );
          }
          return false;
        })
      : null;

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const pickBook = (e) => {
    setForm((f) => ({ ...f, bookId: e.target.value, quantity: 1 }));
    setErrors((er) => ({ ...er, bookId: undefined, quantity: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    // ── SUBMIT DIGITAL ACCESS ──
    if (accessMode === "digital") {
      if (!form.bookId) {
        setErrors({ bookId: "Please select a book" });
        return;
      }
      if (paymentMode === "credits" && !hasEnoughCredits) {
        toast.error(`Insufficient credits! You need ${currentPlan.credits} credits.`);
        return;
      }

      setSaving(true);
      try {
        const res = await api.post(`/books/${form.bookId}/digital-access`, {
          plan: digitalPlan,
          paymentMode,
        });
        toast.success(res.data.message || `Unlocked "${selected?.title || "Book"}" digitally!`);
        onSaved();
      } catch (err) {
        setFormError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── SUBMIT PHYSICAL BORROW REQUEST ──
    if (existingActiveRequest || isLimitReached) return;

    // Reason optional safe fallback
    const effectiveReason = form.reason?.trim() ? form.reason.trim() : "Borrow for study & reading";

    const formToValidate = {
      ...form,
      reason: effectiveReason,
    };

    const parsed = makeRequestFormSchema(selected?.totalCopies, tier.maxIssueDays).safeParse(formToValidate);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
      });
      setErrors(fe);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/purchase-requests/${request._id}`, {
          bookId: form.bookId,
          quantity: Number(form.quantity),
          neededUntil: form.neededUntil,
          reason: effectiveReason,
        });
        toast.success("Physical request updated");
      } else {
        await api.post("/purchase-requests", {
          bookId: form.bookId,
          quantity: Number(form.quantity),
          neededUntil: form.neededUntil,
          reason: effectiveReason,
        });
        toast.success("Physical request submitted");
      }
      onSaved();
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = isEdit ? "Edit Book Request" : "Request a Book";
  const isApproved = existingActiveRequest?.status === "approved";

  return (
    <>
      <Modal title={modalTitle} onClose={onClose}>
        <form onSubmit={submit} noValidate>
          {formError && <div className="alert-error">{formError}</div>}

          {/* Book Info Header */}
          <div className="field">
            <label htmlFor="bookId">Book</label>
            {isLocked ? (
              <input value={selected?.title || "Loading..."} readOnly />
            ) : (
              <select
                id="bookId"
                name="bookId"
                value={form.bookId}
                onChange={pickBook}
                disabled={loadingBooks}
              >
                <option value="">{loadingBooks ? "Loading books..." : "Select a book"}</option>
                {books.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.title} — {b.author}
                  </option>
                ))}
              </select>
            )}
            {errors.bookId && <span className="error-text">{errors.bookId}</span>}
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 1: CHOOSE ACCESS MODE (Sabse Pehle Yeh Select Hoga)     */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="field" style={{ margin: "14px 0" }}>
            <label style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0f172a", marginBottom: 8, display: "block" }}>
              How do you want to take this book?
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* Option 1: Physical Borrow */}
              <div
                onClick={() => setAccessMode("physical")}
                style={{
                  border: accessMode === "physical" ? "2px solid #6366f1" : "1px solid #cbd5e1",
                  background: accessMode === "physical" ? "#eef2ff" : "#ffffff",
                  padding: "12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: "0.9rem", color: "#3730a3" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  Physical Borrow
                </div>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 4 }}>
                  Issue paper copy from library desk
                </div>
              </div>

              {/* Option 2: Digital Access */}
              <div
                onClick={() => setAccessMode("digital")}
                style={{
                  border: accessMode === "digital" ? "2px solid #10b981" : "1px solid #cbd5e1",
                  background: accessMode === "digital" ? "#ecfdf5" : "#ffffff",
                  padding: "12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: "0.9rem", color: "#065f46" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  Digital Rent / Buy
                </div>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 4 }}>
                  Instant online reading (Day/Week/Year/Lifetime)
                </div>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 2A: AGAR DIGITAL CHUNA TOH PAYMENT & DURATION DETAILS   */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {accessMode === "digital" && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "14px",
                marginBottom: 16,
              }}
            >
              {/* Payment Mode Selector First */}
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6, display: "block" }}>
                How do you want to pay?
              </label>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: paymentMode === "credits" ? "#f59e0b" : "#ffffff",
                    color: paymentMode === "credits" ? "#ffffff" : "#475569",
                    border: paymentMode === "credits" ? "2px solid #d97706" : "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onClick={() => setPaymentMode("credits")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                    <circle cx="12" cy="12" r="7" stroke="#ffffff" strokeWidth="1.5" fill="none" />
                  </svg>
                  Pay via Credits ({userCredits} left)
                </button>

                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: paymentMode === "cash" ? "#10b981" : "#ffffff",
                    color: paymentMode === "cash" ? "#ffffff" : "#475569",
                    border: paymentMode === "cash" ? "2px solid #059669" : "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onClick={() => setPaymentMode("cash")}
                >
                  ₹ Pay via Money / Cash
                </button>
              </div>

              {/* 4 Plan Durations */}
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6, display: "block" }}>
                Select Rental / Purchase Duration:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {digitalPlans.map((p) => {
                  const isSel = digitalPlan === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setDigitalPlan(p.id)}
                      style={{
                        border: isSel ? "2px solid #10b981" : "1px solid #cbd5e1",
                        background: isSel ? "#ffffff" : "#f1f5f9",
                        borderRadius: 8,
                        padding: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#1e293b" }}>{p.title}</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{p.desc}</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#047857", marginTop: 4 }}>
                        {paymentMode === "credits" ? `${p.credits} Credits` : `₹${p.inr}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 2B: AGAR PHYSICAL CHUNA TOH QUANTITY & NEEDED UNTIL     */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {accessMode === "physical" && (
            <>
              {/* Quantity */}
              <div className="field">
                <label htmlFor="quantity">Quantity</label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  max={selected ? selected.totalCopies : 1}
                  value={form.quantity}
                  onChange={change}
                />
                {errors.quantity ? (
                  <span className="error-text">{errors.quantity}</span>
                ) : selected ? (
                  <span className="hint">Library has {selected.totalCopies} total copies.</span>
                ) : null}
              </div>

              {/* Needed until */}
              <div className="field">
                <label htmlFor="neededUntil">Needed until</label>
                <input
                  id="neededUntil"
                  name="neededUntil"
                  type="date"
                  min={dateInput(1)}
                  max={
                    tier.tier !== "ultimate" && tier.maxIssueDays !== Infinity
                      ? dateInput(tier.maxIssueDays)
                      : undefined
                  }
                  value={form.neededUntil}
                  onChange={change}
                />
                {errors.neededUntil ? (
                  <span className="error-text">{errors.neededUntil}</span>
                ) : (
                  <span className="hint">
                    Plan limit: <strong>{tier.tier === "ultimate" ? "All upcoming dates available" : `Max ${tier.maxIssueDays} days`}</strong>.
                  </span>
                )}
              </div>

              {/* Physical Borrow Warnings */}
              {isLimitReached && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    backgroundColor: "rgba(229, 57, 53, 0.1)",
                    border: "1px solid var(--danger, #e53935)",
                    marginBottom: 14,
                  }}
                >
                  <strong style={{ color: "var(--danger, #e53935)", fontSize: 13 }}>
                    Physical Limit Reached ({totalActiveUsed}/{tier.maxBooks})
                  </strong>
                  <p style={{ margin: "2px 0 0", fontSize: 12 }}>
                    Upgrade plan or switch above to <strong>Digital Rent / Buy</strong> to read online without physical slot limits.
                  </p>
                </div>
              )}

              {existingActiveRequest && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    backgroundColor: isApproved ? "rgba(22, 163, 74, 0.1)" : "rgba(237, 108, 2, 0.1)",
                    border: isApproved ? "1px solid #16a34a" : "1px solid #ed6c02",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: isApproved ? "#15803d" : "#ed6c02", fontSize: 13 }}>
                      Active physical request exists!
                    </strong>
                    {statusBadge(existingActiveRequest.status)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reason Field (Always Optional) */}
          <div className="field">
            <label htmlFor="reason">Reason (Optional)</label>
            <textarea
              id="reason"
              name="reason"
              rows={2}
              value={form.reason}
              onChange={change}
              placeholder="Why do you need this book?"
            />
          </div>

          {/* Submit Actions */}
          <div className="modal-actions">
            <button type="button" className="btn btn-soft" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              style={
                accessMode === "digital"
                  ? { background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff" }
                  : undefined
              }
              disabled={
                saving ||
                (accessMode === "physical" && (Boolean(existingActiveRequest) || isLimitReached)) ||
                (accessMode === "digital" && paymentMode === "credits" && !hasEnoughCredits)
              }
            >
              {saving
                ? "Processing..."
                : accessMode === "digital"
                ? paymentMode === "credits"
                  ? `Unlock Online (${currentPlan.credits} Credits)`
                  : `Pay ₹${currentPlan.inr} & Unlock`
                : isEdit
                ? "Update Request"
                : "Submit Physical Request"}
            </button>
          </div>
        </form>
      </Modal>

      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}