import { useEffect, useState } from "react";

const SERVER_URL = "http://localhost:5001";

export default function BookCard({ book, actions, isUnlocked = false }) {
  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("readhub_wishlist") || "[]");
      setInWishlist(saved.includes(book._id));
    } catch {
      setInWishlist(false);
    }
  }, [book._id]);

  const toggleWishlist = (e) => {
    e.stopPropagation();
    try {
      const saved = JSON.parse(localStorage.getItem("readhub_wishlist") || "[]");
      let updated;
      if (saved.includes(book._id)) {
        updated = saved.filter((id) => id !== book._id);
        setInWishlist(false);
      } else {
        updated = [...saved, book._id];
        setInWishlist(true);
      }
      localStorage.setItem("readhub_wishlist", JSON.stringify(updated));
    } catch {
      // fallback
    }
  };

  return (
    <div className="card book-card">
      {/* Floating Wishlist Heart */}
      <button
        type="button"
        onClick={toggleWishlist}
        title={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 5,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "50%",
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.15s ease",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={inWishlist ? "#f43f5e" : "none"}
          stroke={inWishlist ? "#f43f5e" : "#ffffff"}
          strokeWidth="2.2"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* 3D E-Book Cover with Spine & Shadow */}
      <div className="book-cover">
        {book.coverImage ? (
          <img
            src={`${SERVER_URL}${book.coverImage}`}
            alt={book.title}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "10px" }}>
            <span style={{ fontSize: "2.8rem", fontWeight: 800, color: "#C8FF3D" }}>
              {book.title.charAt(0).toUpperCase()}
            </span>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.8, color: "#ffffff" }}>
              E-Book
            </div>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 14,
            zIndex: 4,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Digital Edition
        </div>
      </div>

      {/* Book Metadata */}
      <div className="book-body">
        <h3 title={book.title}>{book.title}</h3>
        <p className="book-author">by {book.author}</p>

        <div className="book-meta">
          {book.category && (
            <span className="badge" style={{ background: "var(--soft)", color: "var(--primary)" }}>
              {book.category}
            </span>
          )}
          {isUnlocked ? (
            <span className="badge badge-success">
              ✓ In Your Library
            </span>
          ) : (
            <span className="badge" style={{ background: "var(--soft-2)", color: "var(--muted)" }}>
              Store Available
            </span>
          )}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>₹{book.price}</span>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: 4 }}>Lifetime</span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700 }}>
              Rent from ₹{book.rentalPlans?.day?.inr || 20}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions: Pure Rent/Purchase Status */}
      <div className="book-actions">
        {isUnlocked ? (
          <button
            type="button"
            disabled
            className="btn btn-sm"
            style={{
              width: "100%",
              fontWeight: 700,
              color: "#047857",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              cursor: "default",
              boxShadow: "none",
            }}
          >
            ✓ Purchased / Rented
          </button>
        ) : (
          actions
        )}
      </div>
    </div>
  );
}