import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api, { SERVER_URL } from "../api/axios";
import { useToast } from "../context/ToastContext";
import RequestFormModal from "../components/RequestFormModal";
import WishlistCategoryModal from "../components/WishlistCategoryModal";
import { formatDate } from "../utils/format";
import {
  getWishlistItems,
  getWishlistCategories,
  removeFromWishlist,
} from "../utils/wishlistStorage";

export default function Wishlist() {
  const toast = useToast();
  const [wishlistEntries, setWishlistEntries] = useState([]);
  const [books, setBooks] = useState([]);
  const [digitalShelf, setDigitalShelf] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter Tab state
  const [activeTab, setActiveTab] = useState("All");
  const [selectedBookForCheckout, setSelectedBookForCheckout] = useState(null);
  const [editingCategoryBook, setEditingCategoryBook] = useState(null);

  // 1. Load Wishlist Entries & Categories
  const syncWishlist = useCallback(() => {
    const entries = getWishlistItems();
    setWishlistEntries(entries);
  }, []);

  useEffect(() => {
    syncWishlist();
    window.addEventListener("wishlist-updated", syncWishlist);
    return () => window.removeEventListener("wishlist-updated", syncWishlist);
  }, [syncWishlist]);

  // 2. Fetch specific book details & user's active digital shelf
  const loadWishlistData = useCallback(async () => {
    if (wishlistEntries.length === 0) {
      setBooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const bookIds = wishlistEntries.map((e) => e.bookId);
      const [shelfRes, ...bookResponses] = await Promise.all([
        api.get("/books/my-digital-shelf").catch(() => ({ data: { digitalShelf: [] } })),
        ...bookIds.map((id) =>
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
  }, [wishlistEntries]);

  useEffect(() => {
    loadWishlistData();
  }, [loadWishlistData]);

  // Combine books with their assigned category
  const booksWithCategory = useMemo(() => {
    return books.map((b) => {
      const entry = wishlistEntries.find((e) => String(e.bookId) === String(b._id));
      return {
        ...b,
        wishlistCategory: entry?.category || "Want to Read",
      };
    });
  }, [books, wishlistEntries]);

  // Filter by Active Category Tab
  const filteredBooks = useMemo(() => {
    if (activeTab === "All") return booksWithCategory;
    return booksWithCategory.filter((b) => b.wishlistCategory === activeTab);
  }, [booksWithCategory, activeTab]);

  // Available categories with counts
  const availableCategories = useMemo(() => {
    const allCats = getWishlistCategories();
    return allCats;
  }, []);

  const handleRemove = (bookId) => {
    removeFromWishlist(bookId);
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

    setSelectedBookForCheckout(b);
  };

  return (
    <>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h2>My Wishlist & Reading Shelves</h2>
          <p>Organize books into custom reading collections to rent or buy later.</p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 24,
        }}
      >
        <button
          className={`btn btn-sm ${activeTab === "All" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("All")}
          style={{ borderRadius: 20, padding: "6px 16px", fontWeight: 700 }}
        >
          All ({booksWithCategory.length})
        </button>

        {availableCategories.map((cat) => {
          const count = booksWithCategory.filter((b) => b.wishlistCategory === cat).length;
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab(cat)}
              style={{
                borderRadius: 20,
                padding: "6px 16px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{cat === "Favorites" ? "⭐" : cat === "Must Read" ? "🔥" : "📁"}</span>
              <span>{cat}</span>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: isActive ? "rgba(255,255,255,0.25)" : "var(--soft)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="empty">Loading your wishlist shelves...</p>
      ) : filteredBooks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--card)", borderRadius: 16 }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: 16 }}>
            {activeTab === "All"
              ? "Your wishlist is empty."
              : `No books saved under "${activeTab}" shelf.`}
          </p>
          <Link to="/purchaser/books" className="btn btn-primary">
            Explore Store & Add Books
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
          {filteredBooks.map((b) => {
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
                      position: "relative",
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

                    {/* Category Tag on Card */}
                    <button
                      type="button"
                      onClick={() => setEditingCategoryBook(b)}
                      title="Click to change shelf / collection"
                      style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        zIndex: 4,
                        background: "rgba(15, 23, 42, 0.8)",
                        backdropFilter: "blur(6px)",
                        color: "#fff",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: 20,
                        padding: "3px 10px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span>📁 {b.wishlistCategory}</span>
                      <span style={{ opacity: 0.7, fontSize: "0.65rem" }}>✏️</span>
                    </button>
                  </div>

                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px", color: "var(--text)" }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0 0 10px" }}>
                    by {b.author}
                  </p>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text)", marginBottom: 14 }}>
                    ₹{b.price}{" "}
                    <span style={{ fontSize: "0.74rem", color: "var(--muted)", fontWeight: 500 }}>
                      Lifetime / Rent from ₹{b.rentalPlans?.day?.inr || 20}
                    </span>
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
                    onClick={() => handleRemove(b._id)}
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

      {/* Checkout Modal */}
      {selectedBookForCheckout && (
        <RequestFormModal
          key={selectedBookForCheckout._id}
          initial={{ bookId: selectedBookForCheckout._id }}
          onClose={() => setSelectedBookForCheckout(null)}
          onSaved={() => {
            setSelectedBookForCheckout(null);
            loadWishlistData();
          }}
        />
      )}

      {/* Change / Manage Category Modal */}
      {editingCategoryBook && (
        <WishlistCategoryModal
          book={editingCategoryBook}
          onClose={() => setEditingCategoryBook(null)}
          onSaved={() => {
            syncWishlist();
            setEditingCategoryBook(null);
          }}
        />
      )}
    </>
  );
}