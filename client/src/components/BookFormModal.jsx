import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import DropZone from "./DropZone";
import ImageCropModal from "./ImageCropModal";
import { useToast } from "../context/ToastContext";
import { bookFormSchema } from "../schemas/bookSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

const PRESET_CATEGORIES = [
  "Programming & Tech",
  "Computer Science",
  "Self-Help & Productivity",
  "Fiction & Literature",
  "Business & Economics",
  "Science & Nature",
  "History & Biography",
  "Mathematics & Logic",
  "Philosophy & Psychology",
];

const empty = {
  title: "",
  author: "",
  isbn: "",
  category: "",
  price: "",
  creditPrice: "",
  totalCopies: 1,
};

export default function BookFormModal({ book, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(book);

  // Category choice initial calculation
  const initialCategory = book?.category || "";
  const isPreset = PRESET_CATEGORIES.includes(initialCategory);

  const [categoryChoice, setCategoryChoice] = useState(() => {
    if (!initialCategory) return "";
    return isPreset ? initialCategory : "Other";
  });
  const [customCategory, setCustomCategory] = useState(() => {
    return isPreset ? "" : initialCategory;
  });

  const [form, setForm] = useState(
    isEdit
      ? {
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          category: book.category || "",
          price: book.price,
          creditPrice: book.creditPrice || Math.max(1, Math.round((book.price || 100) / 10)),
          totalCopies: book.totalCopies,
        }
      : empty
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [coverFile, setCoverFile] = useState(null);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  // Price change hone par Credit Price automatically suggest karein (price / 10)
  const handlePriceChange = (e) => {
    const val = e.target.value;
    const numPrice = Number(val);
    const suggestedCredits = numPrice > 0 ? Math.max(1, Math.round(numPrice / 10)) : "";

    setForm((f) => ({
      ...f,
      price: val,
      creditPrice: suggestedCredits,
    }));
    setErrors((er) => ({ ...er, price: undefined }));
  };

  // Category Dropdown Change
  const handleCategoryChoiceChange = (e) => {
    const val = e.target.value;
    setCategoryChoice(val);
    if (val === "Other") {
      setForm((f) => ({ ...f, category: customCategory }));
    } else {
      setForm((f) => ({ ...f, category: val }));
    }
    setErrors((er) => ({ ...er, category: undefined }));
  };

  // Custom Category Text Input Change
  const handleCustomCategoryInput = (e) => {
    const val = e.target.value;
    setCustomCategory(val);
    setForm((f) => ({ ...f, category: val }));
  };

  const handleFilePicked = (file) => {
    if (!file) return;
    setRawImageSrc(URL.createObjectURL(file));
    setShowCropper(true);
  };

  const handleCropComplete = (croppedFile) => {
    setCoverFile(croppedFile);
    setShowCropper(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Schema validation
    const parsed = bookFormSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path[0];
        if (!fe[key]) fe[key] = i.message;
      });
      setErrors(fe);
      return;
    }

    const payload = { ...parsed.data };
    if (!payload.category) delete payload.category;

    const fd = new FormData();
    Object.entries(payload).forEach(([key, val]) => fd.append(key, val));
    
    // Explicitly append creditPrice if set
    if (form.creditPrice) {
      fd.append("creditPrice", form.creditPrice);
    } else if (form.price) {
      fd.append("creditPrice", Math.max(1, Math.round(Number(form.price) / 10)));
    }

    if (coverFile) fd.append("coverImage", coverFile);

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/books/${book._id}`, fd);
        toast.success("Book updated");
      } else {
        await api.post("/books", fd);
        toast.success("Book added");
      }
      onSaved();
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ name, label, type = "text", hint, required = false, ...rest }) => (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>}
      </label>
      <input id={name} name={name} type={type} value={form[name]} onChange={change} {...rest} />
      {hint && !errors[name] && <span className="hint">{hint}</span>}
      {errors[name] && <span className="error-text">{errors[name]}</span>}
    </div>
  );

  return (
    <>
      <Modal title={isEdit ? "Edit book" : "Add book"} onClose={onClose}>
        <form onSubmit={submit} noValidate>
          {formError && <div className="alert-error">{formError}</div>}

          {Field({ name: "title", label: "Title", required: true })}
          {Field({ name: "author", label: "Author", required: true })}
          {Field({ name: "isbn", label: "ISBN", hint: "10 or 13 digits, hyphens allowed", required: true })}

          {/* ── CATEGORY DROPDOWN WITH "OTHER" OPTION ── */}
          <div className="field">
            <label htmlFor="categorySelect">Category</label>
            <select
              id="categorySelect"
              value={categoryChoice}
              onChange={handleCategoryChoiceChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                fontFamily: "inherit",
                fontSize: "0.9rem",
              }}
            >
              <option value="">Select a category</option>
              {PRESET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Other">Other (Type custom category...)</option>
            </select>
          </div>

          {categoryChoice === "Other" && (
            <div className="field" style={{ marginTop: -4 }}>
              <label htmlFor="customCategory">Custom Category Name</label>
              <input
                id="customCategory"
                type="text"
                placeholder="e.g. Manga, Anthologies, Research..."
                value={customCategory}
                onChange={handleCustomCategoryInput}
                autoFocus
              />
            </div>
          )}

          {/* ── PRICE, CREDITS, & TOTAL COPIES ROW ── */}
          <div
            className="form-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div className="field">
              <label htmlFor="price">
                Price (₹) <span style={{ color: "var(--danger, #e53935)" }}>*</span>
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                value={form.price}
                onChange={handlePriceChange}
                placeholder="499"
                required
              />
              {errors.price && <span className="error-text">{errors.price}</span>}
            </div>

            <div className="field">
              <label htmlFor="creditPrice" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Credits (🪙)
              </label>
              <input
                id="creditPrice"
                name="creditPrice"
                type="number"
                min="1"
                value={form.creditPrice}
                onChange={change}
                placeholder="50"
              />
              <span className="hint" style={{ fontSize: "0.68rem" }}>₹10 = 1C (editable)</span>
            </div>

            <div className="field">
              <label htmlFor="totalCopies">
                Total copies <span style={{ color: "var(--danger, #e53935)" }}>*</span>
              </label>
              <input
                id="totalCopies"
                name="totalCopies"
                type="number"
                min="1"
                value={form.totalCopies}
                onChange={change}
                required
              />
              {errors.totalCopies && <span className="error-text">{errors.totalCopies}</span>}
            </div>
          </div>

          <div className="field">
            <label>Cover image</label>
            <DropZone
              currentUrl={
                coverFile
                  ? URL.createObjectURL(coverFile)
                  : isEdit && book.coverImage
                  ? book.coverImage.startsWith("http")
                    ? book.coverImage
                    : `${SERVER_URL}${book.coverImage.startsWith("/") ? "" : "/"}${book.coverImage}`
                  : null
              }
              onFile={handleFilePicked}
              label="Drag and drop book cover"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-soft" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Add book"}
            </button>
          </div>
        </form>
      </Modal>

      {showCropper && rawImageSrc && (
        <ImageCropModal
          imageSrc={rawImageSrc}
          aspect={3 / 4}
          title="Crop & Rotate Book Cover"
          onClose={() => setShowCropper(false)}
          onComplete={handleCropComplete}
        />
      )}
    </>
  );
}