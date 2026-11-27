import { useState, useEffect } from "react";
import Modal from "./Modal";
import { SERVER_URL } from "../api/axios";
import {
  getWishlistCategories,
  addCustomCategory,
  addToWishlist,
  removeFromWishlist,
  getBookWishlistCategory,
  isInWishlist,
} from "../utils/wishlistStorage";

export default function WishlistCategoryModal({ book, onClose, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Want to Read");
  const [newCatInput, setNewCatInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const alreadyIn = isInWishlist(book?._id);

  useEffect(() => {
    const list = getWishlistCategories();
    setCategories(list);
    const current = getBookWishlistCategory(book?._id);
    if (current) {
      setSelectedCategory(current);
    } else if (list.length > 0) {
      setSelectedCategory(list[0]);
    }
  }, [book]);

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCatInput.trim()) return;
    const added = addCustomCategory(newCatInput);
    if (added) {
      setCategories(getWishlistCategories());
      setSelectedCategory(added);
      setNewCatInput("");
      setIsCreating(false);
    }
  };

  const handleSave = () => {
    addToWishlist(book._id, selectedCategory);
    if (onSaved) onSaved(selectedCategory);
    onClose();
  };

  const handleRemove = () => {
    removeFromWishlist(book._id);
    if (onSaved) onSaved(null);
    onClose();
  };

  return (
    <Modal title="Save to Wishlist Shelf" onClose={onClose} maxWidth="440px">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Book Mini Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 12,
            background: "var(--soft)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 60,
              borderRadius: 6,
              overflow: "hidden",
              flexShrink: 0,
              background: "linear-gradient(135deg, #180d38, #2D1B69)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C8FF3D",
              fontWeight: 800,
            }}
          >
            {book?.coverImage ? (
              <img
                src={`${SERVER_URL}${book.coverImage}`}
                alt={book.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              book?.title?.[0]?.toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {book?.title}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
              by {book?.author}
            </div>
          </div>
        </div>

        {/* Category Selection */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
              Select Collection / Shelf:
            </label>
            {!isCreating && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setIsCreating(true)}
                style={{
                  padding: "2px 8px",
                  fontSize: "0.75rem",
                  background: "transparent",
                  color: "var(--primary)",
                  border: "1px dashed var(--primary)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                + New Category
              </button>
            )}
          </div>

          {/* New Category Input Form */}
          {isCreating && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                padding: 10,
                background: "var(--soft-2)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <input
                type="text"
                autoFocus
                className="input"
                placeholder="e.g. Weekend Reads, Tech AI"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCategory(e)}
                style={{ height: 34, fontSize: "0.82rem", flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleCreateCategory}
                style={{ height: 34, padding: "0 12px" }}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsCreating(false)}
                style={{ height: 34, padding: "0 10px" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Category List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 180,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                    border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "rgba(124, 58, 237, 0.08)" : "var(--surface)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1rem" }}>
                      {cat === "Favorites" ? "⭐" : cat === "Must Read" ? "🔥" : "🔖"}
                    </span>
                    <span style={{ fontSize: "0.88rem", fontWeight: isSelected ? 700 : 500 }}>
                      {cat}
                    </span>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: isSelected ? "5px solid var(--primary)" : "2px solid var(--border)",
                      background: "#fff",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
          {alreadyIn ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={handleRemove}
              style={{ color: "var(--danger)", borderColor: "var(--border)" }}
            >
              Remove from Wishlist
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            style={{ flex: 1, fontWeight: 700 }}
          >
            {alreadyIn ? "Update Category" : "Save to Wishlist"}
          </button>
        </div>
      </div>
    </Modal>
  );
}