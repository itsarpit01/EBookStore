import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { getEffectiveTier } from "../utils/membershipConfig";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import RequestFormModal from "../components/RequestFormModal";
import MembershipModal from "../components/MembershipModal";
import DigitalAccessModal from "../components/DigitalAccessModal";
import Modal from "../components/Modal";
import { SearchIcon, RequestIcon } from "../components/Icons";

const LIMIT = 8;

export default function PurchaserBooks() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tier = getEffectiveTier(user);

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);

  // Active slots tracking (Pending/Counter requests + Issued books)
  const [activeSlotsCount, setActiveSlotsCount] = useState(0);
  const [totalUnpaidFines, setTotalUnpaidFines] = useState(0);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showFineBlockedModal, setShowFineBlockedModal] = useState(false);

  // Physical Request state
  const [requestFor, setRequestFor] = useState(null);

  // ── Online Digital Rent / Purchase Modal State ──
  const [digitalBookTarget, setDigitalBookTarget] = useState(null);
  const [userCredits, setUserCredits] = useState(100);
  const [myDigitalShelf, setMyDigitalShelf] = useState([]);

  const debouncedSearch = useDebounce(search);
  const requestId = useRef(0);

  // User ka current active quota, unpaid fines aur credits load karna
  const loadUserQuota = useCallback(async () => {
    try {
      const [reqRes, issueRes, shelfRes] = await Promise.all([
        api.get("/purchase-requests/my").catch(() => ({ data: [] })),
        api.get("/issues/my").catch(() => ({ data: [] })),
        api.get("/books/my-digital-shelf").catch(() => ({ data: { credits: 100, digitalShelf: [] } })),
      ]);

      const reqs = Array.isArray(reqRes.data) ? reqRes.data : [];
      const pendingReqs = reqs.filter((r) =>
        ["pending", "counter_offered"].includes(r.status)
      ).length;

      const issues = Array.isArray(issueRes.data) ? issueRes.data : [];
      const activeIssues = issues.filter((i) => i.status === "issued").length;

      const fines = issues
        .filter((i) => !i.finePaid && ((i.currentFine || 0) > 0 || (i.fine || 0) > 0))
        .reduce((sum, i) => sum + (i.currentFine || i.fine || 0), 0);

      setActiveSlotsCount(pendingReqs + activeIssues);
      setTotalUnpaidFines(fines);

      if (shelfRes.data?.credits !== undefined) {
        setUserCredits(shelfRes.data.credits);
      }
      if (Array.isArray(shelfRes.data?.digitalShelf)) {
        setMyDigitalShelf(shelfRes.data.digitalShelf);
      }
    } catch {
      // Silent fail fallback
    }
  }, []);

  const loadBooks = useCallback(async () => {
    const myId = ++requestId.current;
    setLoading(true);
    try {
      const params = { sort, page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (available) params.available = available;

      const res = await api.get("/books", { params });
      if (myId !== requestId.current) return;
      setBooks(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      if (myId !== requestId.current) return;
      toast.error(getErrorMessage(err));
    } finally {
      if (myId === requestId.current) {
        setLoading(false);
        setFirstLoad(false);
      }
    }
  }, [debouncedSearch, available, sort, page, toast]);

  useEffect(() => {
    loadBooks();
    loadUserQuota();
  }, [loadBooks, loadUserQuota]);

  useEffect(() => {
    const onQuotaUpdated = () => loadUserQuota();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadUserQuota();
    };

    window.addEventListener("quota-updated", onQuotaUpdated);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onQuotaUpdated);

    return () => {
      window.removeEventListener("quota-updated", onQuotaUpdated);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onQuotaUpdated);
    };
  }, [loadUserQuota]);

  const hasFineDue = totalUnpaidFines > 0;
  const isQuotaFull = tier.maxBooks !== Infinity && activeSlotsCount >= tier.maxBooks;

  const handleRequestClick = (bookId = null) => {
    if (hasFineDue) {
      setShowFineBlockedModal(true);
      return;
    }
    if (isQuotaFull) {
      setShowUpgradeModal(true);
      return;
    }
    setRequestFor(bookId ? { bookId } : {});
  };

  // Check if user already owns or rented this book online
  const getActiveDigitalAccess = (bookId) => {
    const item = myDigitalShelf.find(
      (s) => s.book?._id === bookId || s.book === bookId
    );
    if (!item) return null;
    if (!item.expiresAt) return { plan: "lifetime", text: "Owned (Lifetime)" };
    const isExpired = new Date(item.expiresAt) <= new Date();
    if (isExpired) return null;
    return { plan: item.plan, text: `Active (${item.plan.toUpperCase()})` };
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Browse Books</h2>
          <p>{pagination.total} book(s) in the library.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* User Credits Pill Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#fef3c7",
              border: "1px solid #fde68a",
              color: "#b45309",
              padding: "6px 12px",
              borderRadius: 20,
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
            title="Your credits balance for online rent & purchase"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#f59e0b" />
              <circle cx="12" cy="12" r="7.5" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              <text x="12" y="16" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">C</text>
            </svg>
            {userCredits} Credits
          </div>

          {isQuotaFull && !hasFineDue ? (
            <button
              className="btn"
              style={{
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              onClick={() => setShowUpgradeModal(true)}
              title="Quota reached. Click to upgrade your plan."
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Upgrade Plan ({activeSlotsCount}/{tier.maxBooks} used)
            </button>
          ) : (
            <button className="btn" onClick={() => handleRequestClick()}>
              <RequestIcon size={18} /> Request a book
            </button>
          )}
        </div>
      </div>

      {/* Notice Banners */}
      {hasFineDue && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: "0.88rem", color: "var(--text, #333)", fontWeight: 500 }}>
              You have an outstanding late fine of <strong>₹{totalUnpaidFines}</strong>. New book requests are temporarily paused until settled.
            </span>
          </div>
          <button
            className="btn btn-soft btn-sm"
            style={{ fontWeight: 600 }}
            onClick={() => navigate("/purchaser/my-issues")}
          >
            Pay in My Issues →
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <SearchIcon size={18} />
          <input
            placeholder="Search title, author or ISBN"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="toolbar-input"
          value={available}
          onChange={(e) => {
            setAvailable(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All books</option>
          <option value="true">Available</option>
          <option value="false">Not available</option>
        </select>
        <select
          className="toolbar-input"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
          <option value="author">Author A-Z</option>
          <option value="price">Price low to high</option>
          <option value="-price">Price high to low</option>
          <option value="-createdAt">Newest first</option>
        </select>
      </div>

      {firstLoad && loading ? (
        <p className="empty">Loading books...</p>
      ) : books.length === 0 ? (
        <p className="empty">No books found. Try a different search.</p>
      ) : (
        <div
          className="book-grid"
          style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}
        >
          {books.map((b) => {
            const isAvailable = b.availableCopies > 0;
            const digitalAccess = getActiveDigitalAccess(b._id);

            return (
              <BookCard
                key={b._id}
                book={b}
                actions={
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                    {/* ── ACTION 1: Digital Rent / Buy Online ── */}
                    {digitalAccess ? (
                      <div
                        style={{
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          color: "#065f46",
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          textAlign: "center",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {digitalAccess.text}
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "linear-gradient(135deg, #10b981, #059669)",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          border: "none",
                          width: "100%",
                          padding: "6px 10px",
                        }}
                        onClick={() => setDigitalBookTarget(b)}
                        disabled={b.isDiscontinued}
                        title="Rent or buy digital access (Day, Week, Year, Lifetime)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        Read / Rent Online
                      </button>
                    )}

                    {/* ── ACTION 2: Physical Book Loan (Existing Flow) ── */}
                    {isQuotaFull && !hasFineDue ? (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                          color: "#fff",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          width: "100%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                          border: "none",
                        }}
                        onClick={() => setShowUpgradeModal(true)}
                        title="Your physical borrowing limit is reached."
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Upgrade for Physical Copy
                      </button>
                    ) : (
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => handleRequestClick(b._id)}
                        disabled={!isAvailable}
                        title={!isAvailable ? "Physical copy is out of stock" : "Request physical book"}
                        style={{ width: "100%", fontSize: "0.78rem" }}
                      >
                        <RequestIcon size={14} /> {isAvailable ? "Request Physical" : "Physical Out of Stock"}
                      </button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn btn-soft btn-sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* ── Digital Rent / Purchase Modal ── */}
      {digitalBookTarget && (
        <DigitalAccessModal
          book={digitalBookTarget}
          userCredits={userCredits}
          onClose={() => setDigitalBookTarget(null)}
          onSuccess={() => {
            loadUserQuota();
          }}
        />
      )}

      {/* Physical Request Modal */}
      {requestFor && (
        <RequestFormModal
          key={requestFor.bookId || "new"}
          initial={requestFor}
          onClose={() => setRequestFor(null)}
          onSaved={() => {
            setRequestFor(null);
            loadUserQuota();
            toast.info("Track it under My Requests");
          }}
        />
      )}

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {/* Fine Blocked Alert Modal */}
      {showFineBlockedModal && (
        <Modal title="Late Fine Pending" onClose={() => setShowFineBlockedModal(false)}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem" }}>
              Outstanding Fine: ₹{totalUnpaidFines}
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "var(--text-secondary, #666)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              You have an unsettled late fine of ₹{totalUnpaidFines}. Please clear your pending fine in your <strong>My Issues</strong> page to continue borrowing new books.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn btn-soft" onClick={() => setShowFineBlockedModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowFineBlockedModal(false);
                  navigate("/purchaser/my-issues");
                }}
              >
                Go to My Issues & Pay Fine →
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}