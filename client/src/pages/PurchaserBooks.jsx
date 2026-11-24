import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import RequestFormModal from "../components/RequestFormModal";
import { SearchIcon, BookIcon } from "../components/Icons";

const LIMIT = 12;

const CATEGORIES = ["All", "Fiction", "Non-Fiction", "Self-Help", "Technology", "Business", "Mystery", "Sci-Fi"];

export default function PurchaserBooks() {
  const toast = useToast();

  const [books, setBooks] = useState([]);
  const [unlockedBookIds, setUnlockedBookIds] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);

  const [selectedBook, setSelectedBook] = useState(null);
  const debouncedSearch = useDebounce(search);
  const requestId = useRef(0);

  // Load User's Unlocked Digital Shelf (Only Active or Lifetime)
  const loadShelf = useCallback(async () => {
    try {
      const res = await api.get("/books/my-digital-shelf");
      const shelf = res.data?.digitalShelf || [];
      const activeShelf = shelf.filter((item) => {
        if (item.plan === "lifetime" || !item.expiresAt) return true;
        return new Date(item.expiresAt) > new Date();
      });
      const ids = activeShelf.map((item) => String(item.book?._id || item.book));
      setUnlockedBookIds(ids);
    } catch {
      setUnlockedBookIds([]);
    }
  }, []);

  const loadBooks = useCallback(async () => {
    const myId = ++requestId.current;
    setLoading(true);
    try {
      const params = { sort, page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category && category !== "All") params.category = category;

      const res = await api.get("/books", { params });
      if (myId !== requestId.current) return;
      setBooks(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      if (myId !== requestId.current) return;
      toast.error(getErrorMessage(err));
    } finally {
      if (myId === requestId.current) {
        setLoading(false);
        setFirstLoad(false);
      }
    }
  }, [debouncedSearch, category, sort, page, toast]);

  useEffect(() => {
    loadShelf();
    loadBooks();
  }, [loadShelf, loadBooks]);

  return (
    <>
      {/* ── Modern Store Banner (Violet Ink & Neon Lime) ── */}
      <div
        style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #180d38 0%, #2D1B69 60%, #4628a5 100%)",
          color: "#ffffff",
          padding: "36px 32px",
          marginBottom: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
          boxShadow: "0 10px 30px -5px rgba(45, 27, 105, 0.4)",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(200, 255, 61, 0.2)",
        }}
      >
        <div style={{ maxWidth: 600, position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(200, 255, 61, 0.15)",
              color: "#C8FF3D",
              border: "1px solid rgba(200, 255, 61, 0.3)",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: "0.74rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            ✦ Digital E-Book Store
          </div>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 900, lineHeight: 1.2, margin: "0 0 8px" }}>
            Explore Digital Store
          </h2>
          <p style={{ color: "#d8cef5", fontSize: "0.98rem", lineHeight: 1.5 }}>
            Discover bestsellers, rent with flexible passes (1 Day to 1 Year), or purchase lifetime ownership for your library.
          </p>
        </div>

        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "16px 24px",
              borderRadius: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#C8FF3D" }}>{pagination.total || 0}</div>
            <div style={{ fontSize: "0.78rem", color: "#e0d9f7", fontWeight: 600, textTransform: "uppercase" }}>
              Titles in Catalog
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Chips Filter ── */}
      <div className="tabs" style={{ marginBottom: 18 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`tab ${category === cat ? "active" : ""}`}
            onClick={() => {
              setCategory(cat);
              setPage(1);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Toolbar & Search ── */}
      <div className="toolbar">
        <div className="search-box">
          <SearchIcon size={18} />
          <input
            placeholder="Search title, author or ISBN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

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
          <option value="price">Price: Low to High</option>
          <option value="-price">Price: High to Low</option>
          <option value="-createdAt">Newest Releases</option>
        </select>
      </div>

      {/* ── Books Grid ── */}
      {firstLoad && loading ? (
        <p className="empty">Loading digital library...</p>
      ) : books.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <BookIcon size={44} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <h3>No books found in this category</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Try clearing filters or search for another author or keyword.
          </p>
        </div>
      ) : (
        <div className="book-grid" style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
          {books.map((b) => {
            const isUnlocked = unlockedBookIds.includes(String(b._id));
            return (
              <BookCard
                key={b._id}
                book={b}
                isUnlocked={isUnlocked}
                actions={
                  <button
                    className="btn btn-sm btn-block"
                    onClick={() => setSelectedBook(b)}
                  >
                    Rent / Buy
                  </button>
                }
              />
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
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

      {selectedBook && (
        <RequestFormModal
          key={selectedBook._id}
          initial={{ bookId: selectedBook._id }}
          onClose={() => setSelectedBook(null)}
          onSaved={() => {
            setSelectedBook(null);
            loadShelf();
          }}
        />
      )}
    </>
  );
}