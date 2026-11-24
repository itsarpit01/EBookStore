import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { SERVER_URL } from "../api/axios";
import { useToast } from "../context/ToastContext";
import RequestFormModal from "../components/RequestFormModal";
import { formatDate } from "../utils/format";

export default function Wishlist() {
  const toast = useToast();
  const [wishlistIds, setWishlistIds] = useState([]);
  const [books, setBooks] = useState([]);
  const [digitalShelf, setDigitalShelf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);

  // 1. Load saved IDs from LocalStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("readhub_wishlist") || "[]");
      setWishlistIds(saved);
    } catch {
      setWishlistIds([]);
    }
  }, []);

  // 2. Fetch specific book details & user's active digital shelf
  const loadWishlistData = useCallback(async () => {
    if (wishlistIds.length === 0) {
      setBooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [shelfRes, ...bookResponses] = await Promise.all([
        api.get("/books/my-digital-shelf").catch(() => ({ data: { digitalShelf: [] } })),
        ...wishlistIds.map((id) =>
          api
            .get(`/books/${id}`)
            .then((res) => res.data)
            .catch(() => null)
        ),
      ]);

      setDigitalShelf(shelfRes.data?.digitalShelf || []);
      setBooks(bookResponses.filter(Boolean));
    } catch (err) {
      console.error("Failed to load wishlist:", err);
    } finally {
      setLoading(false);
    }
  }, [wishlistIds]);

  useEffect(() => {
    loadWishlistData();
  }, [loadWishlistData]);

  // Remove from Wishlist
  const removeFromWishlist = (bookId) => {
    const updated = wishlistIds.filter((id) => id !== bookId);
    setWishlistIds(updated);
    localStorage.setItem("readhub_wishlist", JSON.stringify(updated));
    toast.info("Removed from Wishlist");
  };

  // Check if book is already owned or rented
  const getOwnershipInfo = (bookId) => {
    const entry = digitalShelf.find(
      (item) => String(item.book?._id || item.book) === String(bookId)
    );
    if (!entry) return null;

    const isLifetime = entry.plan === "lifetime" || !entry.expiresAt;
    const isExpired = entry.expiresAt && new Date(entry.expiresAt) < new Date();

    if (isLifetime) return { status: "lifetime" };
    if (!isExpired) return { status: "rental", expiresAt: entry.expiresAt };

    return null;
  };

  const handleActionClick = (b) => {
    const info = getOwnershipInfo(b._id);

    if (info) {
      if (info.status === "lifetime") {
        toast.info(`You already own permanent lifetime access to "${b.title}"!`);
        return;
      }
      if (info.status === "rental") {
        const dateStr = formatDate(info.expiresAt);
        toast.info(`You have already rented "${b.title}" till ${dateStr}!`);
        return;
      }
    }

    setSelectedBook(b);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Wishlist</h2>
          <p>Books you saved to rent or purchase later.</p>
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading your wishlist...</p>
      ) : books.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: 16 }}>
            Your wishlist is empty.
          </p>
          <Link to="/purchaser/books" className="btn">
            Explore Store & Find Books
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {books.map((b) => {
            const ownership = getOwnershipInfo(b._id);
            const isLifetime = ownership?.status === "lifetime";
            const isRented = ownership?.status === "rental";

            return (
              <div
                key={b._id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: 16,
                  position: "relative",
                }}
              >
                <div>
                  <div
                    style={{
                      height: 180,
                      borderRadius: 10,
                      overflow: "hidden",
                      marginBottom: 12,
                      background: "linear-gradient(135deg, #180d38 0%, #2D1B69 60%, #4628a5 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#C8FF3D",
                      fontSize: "2.5rem",
                      fontWeight: 800,
                    }}
                  >
                    {b.coverImage ? (
                      <img
                        src={`${SERVER_URL}${b.coverImage}`}
                        alt={b.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      b.title.charAt(0)
                    )}
                  </div>

                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px", color: "var(--text)" }}>{b.title}</h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0 0 10px" }}>by {b.author}</p>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text)", marginBottom: 14 }}>
                    ₹{b.price} <span style={{ fontSize: "0.74rem", color: "var(--muted)", fontWeight: 500 }}>Lifetime / Rent from ₹{b.rentalPlans?.day?.inr || 20}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleActionClick(b)}
                    style={{
                      flex: 1,
                      background: isLifetime
                        ? "#ecfdf5"
                        : isRented
                        ? "#eef2ff"
                        : "var(--primary)",
                      color: isLifetime ? "#047857" : isRented ? "#4338ca" : "#fff",
                      border: isLifetime ? "1px solid #a7f3d0" : isRented ? "1px solid #c7d2fe" : "none",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isLifetime
                      ? "✓ Lifetime Owned"
                      : isRented
                      ? `Rented till ${formatDate(ownership.expiresAt)}`
                      : "Rent / Buy"}
                  </button>

                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => removeFromWishlist(b._id)}
                    title="Remove from wishlist"
                    style={{ padding: "0 10px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBook && (
        <RequestFormModal
          key={selectedBook._id}
          initial={{ bookId: selectedBook._id }}
          onClose={() => setSelectedBook(null)}
          onSaved={() => {
            setSelectedBook(null);
            loadWishlistData();
          }}
        />
      )}
    </>
  );
}