import { useEffect, useState } from "react";
import api, { SERVER_URL } from "../api/axios";
import Modal from "./Modal";
import MembershipModal from "./MembershipModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";

export default function RequestFormModal({ initial = {}, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();

  const bookId = initial.bookId || "";

  const [book, setBook] = useState(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [userCredits, setUserCredits] = useState(user?.credits ?? 100);
  const [alreadyOwnedInfo, setAlreadyOwnedInfo] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("week");
  const [paymentMode, setPaymentMode] = useState("credits");
  const [processing, setProcessing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [bookRes, shelfRes] = await Promise.all([
          api.get(`/books/${bookId}`),
          api.get("/books/my-digital-shelf").catch(() => ({ data: { credits: user?.credits ?? 100, digitalShelf: [] } })),
        ]);

        if (!cancelled) {
          setBook(bookRes.data);
          const shelf = shelfRes.data?.digitalShelf || [];
          if (shelfRes.data?.credits !== undefined) {
            setUserCredits(shelfRes.data.credits);
          }

          // Check if already in shelf
          const existing = shelf.find((item) => String(item.book?._id || item.book) === String(bookId));
          if (existing) {
            const isLifetime = existing.plan === "lifetime" || !existing.expiresAt;
            const isExpired = existing.expiresAt && new Date(existing.expiresAt) < new Date();
            if (isLifetime || !isExpired) {
              setAlreadyOwnedInfo({
                isLifetime,
                expiresAt: existing.expiresAt,
              });
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingBook(false);
      }
    };

    if (bookId) loadData();
    return () => {
      cancelled = true;
    };
  }, [bookId, user]);

  const plans = [
    { id: "day", title: "1 Day Pass", duration: "24 Hours Access", credits: 10, inr: book?.rentalPlans?.day?.inr ?? 20 },
    { id: "week", title: "1 Week Pass", duration: "7 Days Rental", credits: 50, inr: book?.rentalPlans?.week?.inr ?? 70, popular: true },
    { id: "year", title: "1 Year Pass", duration: "365 Days Access", credits: 70, inr: book?.rentalPlans?.year?.inr ?? 299 },
    { id: "lifetime", title: "Lifetime Ownership", duration: "Unlimited Forever", credits: 150, inr: book?.price ?? 349 },
  ];

  const currentPlan = plans.find((p) => p.id === selectedPlan) || plans[1];
  const requiredAmount = paymentMode === "credits" ? `${currentPlan.credits} Credits` : `₹${currentPlan.inr}`;
  const hasEnoughCredits = userCredits >= currentPlan.credits;

  const handleInstantUnlock = async () => {
    setError("");

    if (alreadyOwnedInfo) {
      setError(
        alreadyOwnedInfo.isLifetime
          ? "You already own lifetime access to this e-book."
          : "You already have an active rental for this e-book."
      );
      return;
    }

    if (paymentMode === "credits" && !hasEnoughCredits) {
      setError(`Insufficient credits. You need ${currentPlan.credits} credits, but have ${userCredits}.`);
      return;
    }

    setProcessing(true);
    try {
      await api.post(`/books/${bookId}/digital-access`, {
        plan: selectedPlan,
        paymentMode,
      });

      toast.success("E-Book added to your My Library!");
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to complete transaction"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Modal title="Rent / Buy E-Book" onClose={onClose} maxWidth="560px">
        {loadingBook ? (
          <p className="empty">Loading book details...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {error && <div className="alert-error">{error}</div>}

            {/* Already Owned Alert */}
            {alreadyOwnedInfo && (
              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#065f46",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                ✓ You already own or have an active rental for this e-book. You cannot purchase it twice.
              </div>
            )}

            {book && (
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "var(--soft-2)",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 64,
                    borderRadius: 6,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "var(--primary-gradient)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  {book.coverImage ? (
                    <img
                      src={`${SERVER_URL}${book.coverImage}`}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    book.title.charAt(0)
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{book.title}</h4>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>by {book.author}</div>
                  <span className="badge badge-success" style={{ marginTop: 4 }}>
                    Digital Access
                  </span>
                </div>
              </div>
            )}

            {/* Step 1: Select Plan */}
            <div style={{ opacity: alreadyOwnedInfo ? 0.5 : 1, pointerEvents: alreadyOwnedInfo ? "none" : "auto" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: 8, display: "block" }}>
                1. Select Rental or Buy Option
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {plans.map((p) => {
                  const isSelected = selectedPlan === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlan(p.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "var(--soft)" : "var(--surface)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        position: "relative",
                      }}
                    >
                      {p.popular && (
                        <span
                          style={{
                            position: "absolute",
                            top: -8,
                            right: 8,
                            background: "var(--primary)",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: 999,
                            textTransform: "uppercase",
                          }}
                        >
                          Popular
                        </span>
                      )}
                      <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text)" }}>{p.title}</div>
                      <div style={{ fontSize: "0.74rem", color: "var(--muted)", margin: "2px 0 6px" }}>{p.duration}</div>
                      <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--primary)" }}>
                        {p.credits} Credits <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>(or ₹{p.inr})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Payment Method */}
            <div style={{ opacity: alreadyOwnedInfo ? 0.5 : 1, pointerEvents: alreadyOwnedInfo ? "none" : "auto" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: 8, display: "block" }}>
                2. Select Payment Method
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  onClick={() => setPaymentMode("credits")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: paymentMode === "credits" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: paymentMode === "credits" ? "var(--soft)" : "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>Pay with Credits</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>
                    Your Balance: <strong>{userCredits} Credits</strong>
                  </div>
                </div>

                <div
                  onClick={() => setPaymentMode("cash")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: paymentMode === "cash" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: paymentMode === "cash" ? "var(--soft)" : "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>Pay with Cash / UPI</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>
                    Amount: <strong>₹{currentPlan.inr}</strong>
                  </div>
                </div>
              </div>

              {paymentMode === "credits" && !hasEnoughCredits && (
                <div style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--danger)" }}>
                  Need {currentPlan.credits - userCredits} more credits.{" "}
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    Upgrade Pass / Add Credits
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="modal-actions" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <button type="button" className="btn btn-soft" onClick={onClose} disabled={processing}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleInstantUnlock}
                disabled={processing || Boolean(alreadyOwnedInfo) || (paymentMode === "credits" && !hasEnoughCredits)}
                style={{
                  background: alreadyOwnedInfo ? "var(--border)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: alreadyOwnedInfo ? "var(--muted)" : "#fff",
                  fontWeight: 700,
                  padding: "10px 22px",
                  cursor: alreadyOwnedInfo ? "not-allowed" : "pointer",
                }}
              >
                {alreadyOwnedInfo
                  ? "Already in Your Library"
                  : processing
                  ? "Processing..."
                  : `Pay ${requiredAmount} & Add to Library`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}