import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import BookFormModal from "../components/BookFormModal";
import Modal from "../components/Modal";
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from "../components/Icons";

const LIMIT = 8;

export default function LibrarianBooks() {
  const toast = useToast();

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);

  const [formBook, setFormBook] = useState(undefined);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Discontinue Book Modal State ──
  const [toDiscontinue, setToDiscontinue] = useState(null);
  const [discontinueDate, setDiscontinueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [discontinueReason, setDiscontinueReason] = useState("");
  const [discontinuing, setDiscontinuing] = useState(false);

  const debouncedSearch = useDebounce(search);
  const requestId = useRef(0);

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
  }, [loadBooks]);

  const handleSaved = () => {
    setFormBook(undefined);
    loadBooks();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/books/${toDelete._id}`);
      toast.success("Book removed from inventory");
      setToDelete(null);
      if (books.length === 1 && page > 1) setPage(page - 1);
      else loadBooks();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Handle Discontinue Confirmation ──
  const handleOpenDiscontinueModal = (book) => {
    setToDiscontinue(book);
    setDiscontinueDate(new Date().toISOString().split("T")[0]);
    setDiscontinueReason("");
  };

  const confirmDiscontinue = async (e) => {
    e.preventDefault();
    if (!discontinueDate) {
      toast.error("Effective date is mandatory");
      return;
    }

    setDiscontinuing(true);
    try {
      const res = await api.patch(`/books/${toDiscontinue._id}/discontinue`, {
        effectiveDate: discontinueDate,
        reason: discontinueReason,
      });

      toast.success(res.data.message || "Book discontinued from store");
      setToDiscontinue(null);
      loadBooks();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDiscontinuing(false);
    }
  };

  const displayedBooks = books.filter((b) => {
    if (available === "true") {
      return !b.isDiscontinued && b.availableCopies > 0;
    }
    if (available === "false") {
      return b.isDiscontinued || b.availableCopies <= 0;
    }
    return true;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Inventory Catalog</h2>
          <p>{pagination.total} book title(s) in your store inventory.</p>
        </div>
        <button className="btn" onClick={() => setFormBook(null)}>
          <PlusIcon size={18} /> Add to Inventory
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <SearchIcon size={18} />
          <input
            placeholder="Search inventory by title, author or ISBN..."
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
          <option value="">All Inventory</option>
          <option value="true">In Stock / Active</option>
          <option value="false">Out of Stock / Retired</option>
        </select>
        <select
          className="toolbar-input"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="-createdAt">Newest Additions</option>
          <option value="createdAt">Oldest First</option>
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
          <option value="author">Author A-Z</option>
          <option value="price">Price: Low to High</option>
          <option value="-price">Price: High to Low</option>
        </select>
      </div>

      {firstLoad && loading ? (
        <p className="empty">Loading inventory catalog...</p>
      ) : displayedBooks.length === 0 ? (
        <p className="empty">No books found in inventory.</p>
      ) : (
        <div
          className="book-grid"
          style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}
        >
          {displayedBooks.map((b) => (
            <BookCard
              key={b._id}
              book={b}
              actions={
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
                  <button
                    className="btn btn-soft btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setFormBook(b)}
                  >
                    <EditIcon size={15} /> Edit
                  </button>

                  {!b.isDiscontinued ? (
                    <button
                      className="btn btn-sm"
                      style={{
                        background: "#fff7ed",
                        color: "#c2410c",
                        border: "1px solid #ffedd5",
                        flex: 1,
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => handleOpenDiscontinueModal(b)}
                      title="Discontinue this book and notify current readers"
                    >
                      Discontinue
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#dc2626",
                        fontWeight: 600,
                        alignSelf: "center",
                        padding: "0 4px",
                      }}
                    >
                      Retired
                    </span>
                  )}

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setToDelete(b)}
                    title="Delete permanently"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* Direct Jump Pagination */}
      {pagination.totalPages > 1 && (
        <div
          className="pagination"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(1)}
            title="Go to First Page"
          >
            « First
          </button>

          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Previous Page"
          >
            ‹ Prev
          </button>

          <span style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 8px" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            title="Next Page"
          >
            Next ›
          </button>

          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(pagination.totalPages)}
            title="Go to Last Page"
          >
            Last »
          </button>
        </div>
      )}

      {formBook !== undefined && (
        <BookFormModal
          book={formBook}
          onClose={() => setFormBook(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Discontinue Book Modal */}
      {toDiscontinue && (
        <Modal
          title={`Discontinue "${toDiscontinue.title}"`}
          onClose={() => setToDiscontinue(null)}
        >
          <form onSubmit={confirmDiscontinue} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "#fef2f2",
                borderLeft: "4px solid #ef4444",
                padding: "10px 14px",
                borderRadius: "4px",
                fontSize: "0.85rem",
                color: "#991b1b",
                lineHeight: 1.45,
              }}
            >
              <strong>Notice:</strong> Marking this book as discontinued will prevent any new purchases or rentals. Active readers will be given a <strong>7-day grace period</strong> from today to finish reading, and notification emails will be sent strictly to them.
            </div>

            <div className="field">
              <label htmlFor="discontinueDate">
                Effective Date <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                id="discontinueDate"
                type="date"
                required
                value={discontinueDate}
                onChange={(e) => setDiscontinueDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="discontinueReason">
                Reason <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)" }}>(Optional)</span>
              </label>
              <textarea
                id="discontinueReason"
                placeholder="e.g. Outdated edition, rights expired, digital license revised..."
                rows={3}
                value={discontinueReason}
                onChange={(e) => setDiscontinueReason(e.target.value)}
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setToDiscontinue(null)}
                disabled={discontinuing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn"
                style={{ background: "#dc2626", color: "#ffffff" }}
                disabled={discontinuing || !discontinueDate}
              >
                {discontinuing ? "Discontinuing..." : "Confirm Discontinue"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {toDelete && (
        <Modal title="Delete from Inventory" onClose={() => setToDelete(null)}>
          <p>
            Remove <strong>{toDelete.title}</strong> from inventory permanently? This cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToDelete(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Book"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}