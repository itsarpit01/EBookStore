import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";
import ImageCropModal from "../components/ImageCropModal";
import MembershipModal from "../components/MembershipModal";
import DeleteAccountModal from "../components/DeleteAccountModal";
import { profileSchema, passwordFormSchema } from "../schemas/profileSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import { UserIcon } from "../components/Icons";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

const emptyPw = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: "profile" | "transactions" | "settings"
  const activeTab = searchParams.get("tab") || "profile";
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [rawAvatarSrc, setRawAvatarSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Active slots counts
  const [activeBooksCount, setActiveBooksCount] = useState(0);
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);

  // Transaction History State
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Pagination for Transaction History
  const [txPage, setTxPage] = useState(1);
  const txPerPage = 6;

  const [pw, setPw] = useState(emptyPw);
  const [pwErrors, setPwErrors] = useState({});
  const [pwFormError, setPwFormError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Desktop notification pop-ups preference (stored in localStorage)
  const [notificationPopups, setNotificationPopups] = useState(() => {
    return localStorage.getItem("library_notification_popups") !== "false";
  });

  const handleToggleNotificationPopups = (e) => {
    const nextVal = e.target.checked;
    setNotificationPopups(nextVal);
    localStorage.setItem("library_notification_popups", String(nextVal));
    window.dispatchEvent(new Event("notification-pref-updated"));
    if (nextVal) {
      toast.success("Desktop pop-up notifications enabled");
    } else {
      toast.info("Desktop pop-ups disabled. Updates will quietly appear in the bell.");
    }
  };

  const tier = getEffectiveTier(user);

  const loadTransactions = useCallback(() => {
    if (user?.role !== "purchaser") return;
    setLoadingTransactions(true);
    api
      .get("/payment/my-transactions")
      .then((res) => setTransactions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoadingTransactions(false));
  }, [user?.role]);

  useEffect(() => {
    api
      .get("/users/profile")
      .then((res) => {
        setProfile(res.data);
        setName(res.data.name || "");
      })
      .catch((err) => toast.error(getErrorMessage(err, "Failed to load profile")));

    if (user?.role === "purchaser") {
      api
        .get("/issues/my")
        .then((res) => {
          const issued = (res.data || []).filter(
            (i) => i.status === "issued" || i.status === "overdue"
          );
          setActiveBooksCount(issued.length);
        })
        .catch(() => {});

      api
        .get("/purchase-requests/my")
        .then((res) => {
          const pending = (res.data || []).filter(
            (r) => r.status === "pending" || r.status === "approved"
          );
          setActiveRequestsCount(pending.length);
        })
        .catch(() => {});

      loadTransactions();
    }
  }, [user?.role, toast, loadTransactions]);

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawAvatarSrc(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBlob) => {
    setAvatarFile(croppedBlob);
    setAvatarPreview(URL.createObjectURL(croppedBlob));
    setShowCropper(false);
  };

  const saveAvatar = async () => {
    if (!avatarFile) return;
    const formData = new FormData();
    formData.append("avatar", avatarFile, "avatar.jpg");

    try {
      const res = await api.put("/users/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser(res.data);
      setProfile((p) => ({ ...p, avatar: res.data.avatar }));
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update profile photo"));
    }
  };

  const cancelAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const saveName = async (e) => {
    e.preventDefault();
    setNameError("");

    const parsed = profileSchema.safeParse({ name });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      if (issues.length) setNameError(issues[0].message);
      return;
    }

    setSavingName(true);
    try {
      const res = await api.put("/users/profile", { name: parsed.data.name });
      updateUser(res.data);
      setProfile((p) => ({ ...p, name: res.data.name }));
      toast.success("Name updated");
    } catch (err) {
      const fe = getFieldErrors(err);
      if (fe.name) setNameError(fe.name);
      else toast.error(getErrorMessage(err, "Failed to update name"));
    } finally {
      setSavingName(false);
    }
  };

  const changePw = (e) => {
    const { name, value } = e.target;
    setPw((p) => ({ ...p, [name]: value }));
    setPwErrors((pe) => ({ ...pe, [name]: undefined }));
    setPwFormError("");
  };

  const savePw = async (e) => {
    e.preventDefault();
    setPwErrors({});
    setPwFormError("");

    const parsed = passwordFormSchema.safeParse(pw);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
      });
      setPwErrors(fe);
      return;
    }

    setSavingPw(true);
    try {
      await api.put("/users/change-password", {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      toast.success("Password updated successfully");
      setPw(emptyPw);
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length) setPwErrors(fe);
      else setPwFormError(getErrorMessage(err, "Failed to change password"));
    } finally {
      setSavingPw(false);
    }
  };

  const avatarSrc = avatarPreview
    ? avatarPreview
    : profile?.avatar
    ? profile.avatar.startsWith("http")
      ? profile.avatar
      : `${SERVER_URL}${profile.avatar}`
    : null;

  const totalPages = Math.ceil(transactions.length / txPerPage);
  const currentTransactions = transactions.slice(
    (txPage - 1) * txPerPage,
    txPage * txPerPage
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Account Settings</h2>
          <p>Manage your profile, security preferences, and subscription tier.</p>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: 20,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.95rem",
            color: activeTab === "profile" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: activeTab === "profile" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          Profile
        </button>

        {user?.role === "purchaser" && (
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            style={{
              background: "none",
              border: "none",
              padding: "10px 4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.95rem",
              color: activeTab === "transactions" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
              borderBottom: activeTab === "transactions" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
            }}
          >
            Transactions
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.95rem",
            color: activeTab === "settings" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: activeTab === "settings" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
          }}
        >
          Settings
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PROFILE DETAILS & MEMBERSHIP                            */}
      {/* ============================================================== */}
      {activeTab === "profile" && (
        <div style={{ maxWidth: 650, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Avatar Section */}
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid var(--border, #e5e7eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--soft, #f3f4f6)",
                flexShrink: 0,
              }}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <UserIcon size={44} style={{ color: "var(--muted, #999)" }} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  border: isDragging ? "2px dashed var(--primary, #5c6bc0)" : "1.5px dashed var(--border, #ccc)",
                  borderRadius: 8,
                  padding: "12px",
                  textAlign: "center",
                  background: isDragging ? "var(--soft-2, rgba(92,107,192,0.06))" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("avatar-upload-input")?.click()}
              >
                <input
                  id="avatar-upload-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <span style={{ fontSize: "0.85rem", color: "var(--primary, #5c6bc0)", fontWeight: 600 }}>
                  Upload new photo
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", display: "block", marginTop: 2 }}>
                  Drag & drop or click to crop. Max 2MB (JPG, PNG, WebP)
                </span>
              </div>

              {avatarFile && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-sm" onClick={saveAvatar}>
                    Save Photo
                  </button>
                  <button type="button" className="btn btn-sm btn-soft" onClick={cancelAvatar}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Membership Tier Card (Purchaser Only) */}
          {user?.role === "purchaser" && (
            <div
              className="card"
              style={{
                borderLeft: `4px solid ${tier.color}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {tier.name} Membership
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: `${tier.color}18`,
                      color: tier.color,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      fontSize: "0.72rem",
                    }}
                  >
                    Active
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)", marginTop: 6 }}>
                  Book Slots: <strong>{activeBooksCount} / {tier.limits.maxBooks}</strong> active | Request Slots:{" "}
                  <strong>{activeRequestsCount} / {tier.limits.maxRequests}</strong> active
                </div>
              </div>

              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setShowMembershipModal(true)}
                style={{ borderColor: tier.color, color: tier.color }}
              >
                Change Tier
              </button>
            </div>
          )}

          {/* Personal Info Form */}
          <form className="card" onSubmit={saveName} noValidate>
            <h3 style={{ marginTop: 0, fontSize: "1.15rem" }}>Personal Information</h3>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={profile?.email || ""}
                disabled
                style={{ background: "var(--soft, #f9fafb)", cursor: "not-allowed" }}
              />
              <span className="hint">Email address cannot be changed.</span>
            </div>

            <div className="field">
              <label htmlFor="role">Account Role</label>
              <input
                id="role"
                type="text"
                value={profile?.role || ""}
                disabled
                style={{
                  background: "var(--soft, #f9fafb)",
                  cursor: "not-allowed",
                  textTransform: "capitalize",
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Your full name"
              />
              {nameError && <span className="error-text">{nameError}</span>}
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn"
                disabled={savingName || !name.trim() || name === profile?.name}
              >
                {savingName ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: TRANSACTIONS (PAGINATED RECORD)                         */}
      {/* ============================================================== */}
      {activeTab === "transactions" && user?.role === "purchaser" && (
        <div style={{ maxWidth: 800 }}>
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: "1.15rem", marginBottom: 16 }}>
              Membership Payments & Invoices
            </h3>

            {loadingTransactions ? (
              <p className="empty">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="empty">No membership transactions found on your account.</p>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Payment ID</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTransactions.map((tx) => (
                        <tr key={tx._id}>
                          <td>{formatDate(tx.createdAt)}</td>
                          <td style={{ fontWeight: 600, textTransform: "capitalize" }}>
                            {tx.plan}
                          </td>
                          <td>₹{tx.amount}</td>
                          <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                            {tx.razorpayPaymentId || "-"}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: tx.status === "captured" ? "#dcfce7" : "#fee2e2",
                                color: tx.status === "captured" ? "#166534" : "#991b1b",
                                textTransform: "uppercase",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                              }}
                            >
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: "1px solid var(--border, #f1f5f9)",
                    }}
                  >
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary, #666)" }}>
                      Page {txPage} of {totalPages}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-soft"
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPage === 1}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-soft"
                        onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))}
                        disabled={txPage === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SETTINGS (NOTIFICATIONS, PASSWORD & DANGER ZONE)         */}
      {/* ============================================================== */}
      {activeTab === "settings" && (
        <div style={{ maxWidth: 580, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Notification Preferences */}
          <div
            className="card"
            style={{
              background: "var(--surface, #ffffff)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--text, #111827)" }}>
                Desktop Notification Pop-ups
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary, #6b7280)", lineHeight: 1.45 }}>
                Show pop-up banner alerts on your screen when new updates arrive. When turned off, notifications will quietly appear only in the notification bell.
              </p>
            </div>
            <label
              style={{
                position: "relative",
                display: "inline-block",
                width: 48,
                height: 26,
                flexShrink: 0,
                cursor: "pointer",
              }}
              title={notificationPopups ? "Click to disable pop-ups" : "Click to enable pop-ups"}
            >
              <input
                type="checkbox"
                checked={notificationPopups}
                onChange={handleToggleNotificationPopups}
                style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: notificationPopups ? "var(--primary, #5c6bc0)" : "#d1d5db",
                  transition: "0.2s",
                  borderRadius: 26,
                }}
              />
              <span
                style={{
                  position: "absolute",
                  height: 20,
                  width: 20,
                  left: notificationPopups ? 25 : 3,
                  bottom: 3,
                  backgroundColor: "#ffffff",
                  transition: "0.2s",
                  borderRadius: "50%",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </label>
          </div>

          {/* Security & Password Form */}
          <form className="card" onSubmit={savePw} noValidate>
            <h3 style={{ marginTop: 0, fontSize: "1.15rem" }}>Security & Password</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
              Ensure your account is using a secure, long password.
            </p>

            {pwFormError && <div className="alert-error">{pwFormError}</div>}

            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                value={pw.currentPassword}
                onChange={changePw}
                error={pwErrors.currentPassword}
              />
            </div>

            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                value={pw.newPassword}
                onChange={changePw}
                error={pwErrors.newPassword}
              />
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={pw.confirmPassword}
                onChange={changePw}
                error={pwErrors.confirmPassword}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn"
                disabled={savingPw || !pw.currentPassword || !pw.newPassword}
              >
                {savingPw ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>

          {/* Account Deletion (Purchaser Only) */}
          {user?.role === "purchaser" && (
            <div
              className="card"
              style={{
                border: "1px solid rgba(220, 38, 38, 0.25)",
                background: "var(--surface, #ffffff)",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text, #111827)" }}>
                    Delete Account
                  </h3>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(220, 38, 38, 0.08)",
                      color: "#dc2626",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    Irreversible
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "var(--text-secondary, #6b7280)",
                    lineHeight: 1.5,
                  }}
                >
                  Permanently delete your account, active membership, and all associated library history. This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  padding: "9px 18px",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "#dc2626",
                  background: "transparent",
                  border: "1px solid #dc2626",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dc2626";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                Delete Account
              </button>
            </div>
          )}
        </div>
      )}

      {showCropper && rawAvatarSrc && (
        <ImageCropModal
          imageSrc={rawAvatarSrc}
          aspectRatio={1}
          onCropComplete={handleCropComplete}
          onClose={() => setShowCropper(false)}
        />
      )}

      {showMembershipModal && (
        <MembershipModal onClose={() => setShowMembershipModal(false)} />
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          userEmail={user?.email}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}