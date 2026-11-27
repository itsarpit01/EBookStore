const STORAGE_KEY = "readhub_wishlist";
const CATEGORIES_KEY = "readhub_wishlist_categories";

export const DEFAULT_CATEGORIES = ["Want to Read", "Favorites", "Must Read"];

// 1. Wishlist Items fetch karna (Old string IDs format ko bhi gracefully handle karta hai)
export const getWishlistItems = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return raw.map((item) => {
      if (typeof item === "string") {
        return { bookId: item, category: "Want to Read" };
      }
      return item;
    });
  } catch {
    return [];
  }
};

// 2. Categories List fetch karna
export const getWishlistCategories = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "null");
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
  } catch {}
  return DEFAULT_CATEGORIES;
};

// 3. Nayi Category Add karna
export const addCustomCategory = (categoryName) => {
  const trimmed = (categoryName || "").trim();
  if (!trimmed) return false;

  const current = getWishlistCategories();
  const exists = current.some((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    const updated = [...current, trimmed];
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("wishlist-updated"));
  }
  return trimmed;
};

// 4. Book Wishlist me hai ya nahi check karna
export const isInWishlist = (bookId) => {
  const items = getWishlistItems();
  return items.some((i) => String(i.bookId) === String(bookId));
};

// 5. Book ki current category pata karna
export const getBookWishlistCategory = (bookId) => {
  const items = getWishlistItems();
  const found = items.find((i) => String(i.bookId) === String(bookId));
  return found ? found.category || "Want to Read" : null;
};

// 6. Book ko Wishlist me Add / Update karna
export const addToWishlist = (bookId, category = "Want to Read") => {
  const items = getWishlistItems();
  const existingIndex = items.findIndex((i) => String(i.bookId) === String(bookId));

  if (existingIndex >= 0) {
    items[existingIndex].category = category;
  } else {
    items.push({ bookId, category, addedAt: new Date().toISOString() });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("wishlist-updated"));
};

// 7. Wishlist se remove karna
export const removeFromWishlist = (bookId) => {
  const items = getWishlistItems();
  const filtered = items.filter((i) => String(i.bookId) !== String(bookId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new Event("wishlist-updated"));
};