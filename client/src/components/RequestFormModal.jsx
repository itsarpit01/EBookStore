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
  const [paymentMode, setPaymentMode] = useState("razorpay"); // Default to Razorpay
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
  const hasEnoughCredits = userCredits >= currentPlan.credits;

  // Helper to load Razorpay script on-the-fly
  const ensureRazorpayLoaded = async () => {
    if (window.Razorpay) return true;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    setError("");

    if (alreadyOwnedInfo) {
      setError(
        alreadyOwnedInfo.isLifetime
          ? "You already own lifetime access to this e-book."
          : "You already have an active rental for this e-book."
      );
      return;
    }

    // ───────────────────────────────────────────
    // OPTION 1: PAY WITH CREDITS (Instant Deduct)
    // ───────────────────────────────────────────
    if (paymentMode === "credits") {
      if (!hasEnoughCredits) {
        setError(`Insufficient credits. You need ${currentPlan.credits} credits, but have ${userCredits}.`);
        return;
      }

      setProcessing(true);
      try {
        await api.post(`/books/${bookId}/digital-access`, {
          plan: selectedPlan,
          paymentMode: "credits",
        });

        toast.success(`"${book?.title || 'Book'}" unlocked with ${currentPlan.credits} credits!`);
        window.dispatchEvent(new Event("quota-updated"));
        if (onSaved) onSaved();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, "Failed to complete transaction"));
      } finally {
        setProcessing(false);
      }
      return;
    }

    // ───────────────────────────────────────────
    // OPTION 2: PAY WITH RAZORPAY (Card / UPI)
    // ───────────────────────────────────────────
    const sdkLoaded = await ensureRazorpayLoaded();
    if (!sdkLoaded || !window.Razorpay) {
      setError("Razorpay SDK failed to load. Please check your internet connection.");
      return;
    }

    setProcessing(true);
    try {
      // 1. Create order on backend
      const res = await api.post("/payment/create-book-order", {
        bookId,
        plan: selectedPlan,
      });

      const { orderId, amount, currency, keyId } = res.data;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency: currency || "INR",
        name: "ReadHub E-Book Store",
        description: `${currentPlan.title} • ${book?.title || "E-Book"}`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#2D1B69",
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
        handler: async function (response) {
          try {
            // 3. Verify signature on backend
            await api.post("/payment/verify-book-order", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookId,
              plan: selectedPlan,
            });

            toast.success(`Payment verified! "${book?.title || 'Book'}" added to your My Library!`);
            window.dispatchEvent(new Event("quota-updated"));
            if (onSaved) onSaved();
            onClose();
          } catch (verifyErr) {
            setError(getErrorMessage(verifyErr, "Payment verification failed"));
          } finally {
            setProcessing(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        setError(resp.error?.description || "Payment failed. Please try again.");
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to initiate Razorpay checkout"));
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
                ✓ You already have active access to this e-book. You cannot purchase or rent it twice.
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
                    book.title?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "1rem" }}>{book.title}</h4>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>by {book.author}</span>
                </div>
              </div>
            )}

            {/* Step 1: Select Plan */}
            <div style={{ opacity: alreadyOwnedInfo ? 0.5 : 1, pointerEvents: alreadyOwnedInfo ? "none" : "auto" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: 8, display: "block" }}>
                1. Select Digital Access Plan
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {plans.map((p) => {
                  const isSelected = selectedPlan === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlan(p.id)}
                      style={{
                        padding: "12px",
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
                        ₹{p.inr} <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>({p.credits} Credits)</span>
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
                {/* Razorpay Online Option */}
                <div
                  onClick={() => setPaymentMode("razorpay")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: paymentMode === "razorpay" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: paymentMode === "razorpay" ? "var(--soft)" : "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem" }}>Pay Online / UPI</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#2D1B69", color: "#C8FF3D", padding: "1px 6px", borderRadius: 4 }}>
                      Razorpay
                    </span>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 4 }}>
                    Amount: <strong>₹{currentPlan.inr}</strong> (UPI, Cards, NetBanking)
                  </div>
                </div>

                {/* Credits Option */}
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
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 4 }}>
                    Cost: <strong>{currentPlan.credits} Credits</strong> (Balance: {userCredits})
                  </div>
                </div>
              </div>

              {paymentMode === "credits" && !hasEnoughCredits && (
                <div style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--danger)" }}>
                  Need {currentPlan.credits - userCredits} more credits.{" "}
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Upgrade Pass for more credits
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button type="button" className="btn btn-soft" onClick={onClose} disabled={processing}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCheckout}
                disabled={processing || Boolean(alreadyOwnedInfo) || (paymentMode === "credits" && !hasEnoughCredits)}
              >
                {processing ? (
                  "Processing..."
                ) : paymentMode === "razorpay" ? (
                  `Pay ₹${currentPlan.inr} via Razorpay`
                ) : (
                  `Unlock with ${currentPlan.credits} Credits`
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {showUpgradeModal && <MembershipModal onClose={() => setShowUpgradeModal(false)} />}
    </>
  );
}