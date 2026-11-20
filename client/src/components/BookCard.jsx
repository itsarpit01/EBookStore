const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

export default function BookCard({ book, actions }) {
  const available = book.availableCopies > 0;

  // ── 7-Day New Arrival Calculation ──
  const isNewArrival = (() => {
    if (!book.createdAt || book.isDiscontinued) return false;
    const createdTime = new Date(book.createdAt).getTime();
    if (isNaN(createdTime)) return false;
    const diffDays = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  })();

  // ── Credits Calculation (Fallback: ₹10 = 1 Credit) ──
  const credits =
    book.creditPrice || Math.max(1, Math.round((book.price || 100) / 10));

  const coverSrc = book.coverImage
    ? book.coverImage.startsWith("http")
      ? book.coverImage
      : `${SERVER_URL}${book.coverImage.startsWith("/") ? "" : "/"}${book.coverImage}`
    : null;

  return (
    <div
      className="card book-card"
      style={{
        opacity: book.isDiscontinued ? 0.85 : 1,
        border: book.isDiscontinued
          ? "1px dashed #f87171"
          : isNewArrival
          ? "1px dashed #10b981"
          : undefined,
      }}
    >
      <div className="book-cover" style={{ position: "relative" }}>
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={book.title}
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        ) : (
          <span>{book.title?.charAt(0)?.toUpperCase()}</span>
        )}

        {/* ── RIBBONS (Discontinued > New Arrival) ── */}
        {book.isDiscontinued ? (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              zIndex: 2,
            }}
          >
            Discontinued
          </span>
        ) : isNewArrival ? (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "#10b981",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              zIndex: 2,
            }}
          >
            New Arrival
          </span>
        ) : null}
      </div>

      <div className="book-body">
        <h3 title={book.title}>{book.title}</h3>
        <p className="book-author">{book.author}</p>
        
        <div className="book-meta">
          {book.category && <span className="badge">{book.category}</span>}
          {book.isDiscontinued ? (
            <span
              className="badge"
              style={{ background: "#fee2e2", color: "#dc2626", fontWeight: 600 }}
              title={book.discontinueReason ? `Reason: ${book.discontinueReason}` : "Discontinued"}
            >
              Retired Catalog
            </span>
          ) : (
            <span className={`badge ${available ? "badge-success" : "badge-danger"}`}>
              {available ? `${book.availableCopies}/${book.totalCopies} available` : "Not available"}
            </span>
          )}
        </div>

        <p className="book-isbn">ISBN {book.isbn}</p>

        {/* ── DUAL PRICING DISPLAY: Cash (₹) / Credits (🪙) ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            margin: "8px 0 4px 0",
          }}
        >
          <span
            style={{
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "var(--text-primary, #1e293b)",
            }}
          >
            ₹{book.price}
          </span>

          <span style={{ color: "#94a3b8", fontWeight: 600 }}>/</span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "#fef3c7",
              color: "#b45309",
              padding: "2px 8px",
              borderRadius: "6px",
              fontWeight: 700,
              fontSize: "0.8rem",
              border: "1px solid #fde68a",
            }}
            title="Lifetime purchase or rental available using Credits"
          >
            {/* Inline SVG Credit Coin */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" fill="#f59e0b" />
              <circle cx="12" cy="12" r="7.5" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="900"
                fontFamily="sans-serif"
              >
                C
              </text>
            </svg>
            {credits} Credits
          </span>
        </div>

        {/* Access Options Indicator */}
        <div
          style={{
            fontSize: "0.72rem",
            color: "#64748b",
            display: "flex",
            gap: "5px",
            alignItems: "center",
            marginBottom: "6px",
          }}
        >
          <span>Plans:</span>
          <span style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "3px" }}>Day</span>
          <span style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "3px" }}>Week</span>
          <span style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "3px" }}>Year</span>
          <span style={{ background: "#ede9fe", color: "#6d28d9", fontWeight: 600, padding: "1px 5px", borderRadius: "3px" }}>Lifetime</span>
        </div>
      </div>

      {actions && <div className="book-actions">{actions}</div>}
    </div>
  );
}