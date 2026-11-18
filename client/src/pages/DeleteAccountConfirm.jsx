import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";

export default function DeleteAccountConfirm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No deletion token provided in URL. Please check the link from your email.");
      setLoading(false);
      return;
    }

    api
      .get(`/users/verify-delete-token/${token}`)
      .then((res) => {
        setUserData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(getErrorMessage(err));
        setLoading(false);
      });
  }, [token]);

  const handleConfirmDelete = async () => {
    if (!token || verifying) return;
    setVerifying(true);

    try {
      const res = await api.post("/users/confirm-account-deletion", { token });
      setDeleted(true);
      toast.success(res.data.message || "Account permanently deleted.");
      if (logout) logout();
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setVerifying(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "var(--bg, #f8fafc)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "var(--surface, #ffffff)",
          borderRadius: 16,
          padding: "36px 32px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          border: "1px solid var(--border, #e5e7eb)",
        }}
      >
        {/* Header Icon + Title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: deleted ? "#ecfdf5" : error ? "#fef2f2" : "#fee2e2",
              color: deleted ? "#059669" : "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              boxShadow: "0 4px 6px -1px rgba(220, 38, 38, 0.1)",
            }}
          >
            {deleted ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            )}
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: 800, color: "var(--text, #111827)", letterSpacing: "-0.02em" }}>
            {deleted
              ? "Account Deleted"
              : error
              ? "Link Expired or Invalid"
              : "Confirm Account Deletion"}
          </h2>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary, #6b7280)", lineHeight: 1.5 }}>
            {deleted
              ? "Your account and personal records have been permanently removed."
              : error
              ? "We could not verify this deletion request. It may have expired."
              : "Review the details below before permanently closing your account."}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary, #6b7280)", fontSize: "0.92rem" }}>
            Verifying deletion token...
          </div>
        ) : deleted ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <p style={{ fontSize: "0.95rem", color: "var(--text, #374151)", lineHeight: 1.6, margin: "0 0 24px 0" }}>
              All your records, borrowing history, and credentials have been erased. Redirecting to login in a few seconds...
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => navigate("/login")}
              style={{ padding: "10px 24px", fontSize: "0.92rem" }}
            >
              Go to Login Now &rarr;
            </button>
          </div>
        ) : error ? (
          <div>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "16px",
                color: "#991b1b",
                fontSize: "0.9rem",
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              <strong>Error:</strong> {error}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => navigate("/")}
                style={{ padding: "10px 24px" }}
              >
                &larr; Return to Dashboard
              </button>
            </div>
          </div>
        ) : userData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Account Details Box */}
            <div
              style={{
                background: "var(--surface-soft, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 10,
                padding: "16px 20px",
                fontSize: "0.88rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
                <div>
                  <span style={{ color: "var(--text-secondary, #64748b)", fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                    Name
                  </span>
                  <strong style={{ color: "var(--text, #1e293b)", fontSize: "0.95rem" }}>{userData.user.name}</strong>
                </div>

                <div>
                  <span style={{ color: "var(--text-secondary, #64748b)", fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                    Membership
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      background: "#e0e7ff",
                      color: "#4338ca",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: 4,
                      textTransform: "capitalize",
                      marginTop: 2,
                    }}
                  >
                    {userData.user.membership} Plan
                  </span>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "var(--text-secondary, #64748b)", fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                    Email
                  </span>
                  <span style={{ color: "var(--text, #1e293b)", fontWeight: 500 }}>{userData.user.email}</span>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "var(--text-secondary, #64748b)", fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                    Member ID
                  </span>
                  <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: "0.8rem", color: "#475569" }}>
                    {userData.user.id}
                  </code>
                </div>
              </div>
            </div>

            {/* Terms of Deletion Alert */}
            <div
              style={{
                background: "#fff5f5",
                borderLeft: "4px solid #ef4444",
                borderTop: "1px solid #fed7d7",
                borderRight: "1px solid #fed7d7",
                borderBottom: "1px solid #fed7d7",
                borderRadius: 8,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#991b1b", fontSize: "0.92rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span>⚠️ Permanent Action Warning</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.84rem", color: "#b91c1c", lineHeight: 1.6 }}>
                <li>Your profile credentials and personal details will be erased permanently.</li>
                <li>Your active membership plan and borrowing capacities will be terminated.</li>
                <li>All transaction history, invoices, and issue records will be removed.</li>
                <li>You will immediately be logged out from all active sessions.</li>
              </ul>
            </div>

            {/* Pre-flight Checks (Status Pill Box) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "12px 14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: userData.activeBooks === 0 ? "#15803d" : "#dc2626", fontWeight: 600 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {userData.activeBooks === 0 ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                </svg>
                <span>
                  Borrowed Books: {userData.activeBooks === 0 ? "0 active (Cleared)" : `${userData.activeBooks} unreturned`}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, color: userData.totalUnpaidFines === 0 ? "#15803d" : "#dc2626", fontWeight: 600 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {userData.totalUnpaidFines === 0 ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                </svg>
                <span>
                  Outstanding Fine Dues: {userData.totalUnpaidFines === 0 ? "₹0 (Cleared)" : `₹${userData.totalUnpaidFines} Due`}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-soft"
                disabled={verifying}
                onClick={() => navigate("/")}
                style={{ padding: "10px 18px", fontSize: "0.9rem" }}
              >
                Cancel & Keep Account
              </button>
              <button
                type="button"
                className="btn"
                disabled={verifying || userData.hasBlockers}
                onClick={handleConfirmDelete}
                style={{
                  background: "#dc2626",
                  borderColor: "#dc2626",
                  color: "#ffffff",
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  opacity: verifying || userData.hasBlockers ? 0.6 : 1,
                  cursor: verifying || userData.hasBlockers ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 3px rgba(220, 38, 38, 0.3)",
                }}
              >
                {verifying ? "Deleting Account..." : "Permanently Delete My Account"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}