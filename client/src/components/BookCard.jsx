const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

export default function BookCard({ book, actions }) {
  const available = book.availableCopies > 0;

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
        border: book.isDiscontinued ? "1px dashed #f87171" : undefined,
      }}
    >
      <div className="book-cover" style={{ position: "relative" }}>
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={book.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        ) : (
          <span>{book.title?.charAt(0)?.toUpperCase()}</span>
        )}

        {book.isDiscontinued && (
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
            }}
          >
            Discontinued
          </span>
        )}
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
        <p className="book-price">₹{book.price}</p>
      </div>

      {actions && <div className="book-actions">{actions}</div>}
    </div>
  );
}