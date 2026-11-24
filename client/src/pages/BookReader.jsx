import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";

export default function BookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [readerTheme, setReaderTheme] = useState("sepia"); // 'light', 'sepia', 'dark'
  const [page, setPage] = useState(1);

  const totalPages = 12;

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await api.get(`/books/${id}`);
        setBook(res.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [id, toast]);

  const themes = {
    light: { bg: "#ffffff", text: "#1e293b", paper: "#f8fafc" },
    sepia: { bg: "#fbf0d9", text: "#433422", paper: "#f4e4c1" },
    dark: { bg: "#0f172a", text: "#e2e8f0", paper: "#1e293b" },
  };

  const currentTheme = themes[readerTheme];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        Loading e-book reader...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: currentTheme.bg,
        color: currentTheme.text,
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Reader Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          borderBottom: `1px solid ${readerTheme === "dark" ? "#334155" : "#e2e8f0"}`,
          background: currentTheme.paper,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="btn btn-soft btn-sm"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          ← Back to Library
        </button>

        <div style={{ textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: "0.95rem" }}>{book?.title || "Book Reader"}</strong>
          <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>{book?.author}</span>
        </div>

        {/* Reader Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Font Size */}
          <button
            onClick={() => setFontSize((s) => Math.max(14, s - 2))}
            style={{ padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}
            title="Smaller text"
          >
            A-
          </button>
          <span style={{ fontSize: "0.8rem", minWidth: 20, textAlign: "center" }}>{fontSize}</span>
          <button
            onClick={() => setFontSize((s) => Math.min(26, s + 2))}
            style={{ padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}
            title="Larger text"
          >
            A+
          </button>

          {/* Theme Selector */}
          <select
            value={readerTheme}
            onChange={(e) => setReaderTheme(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              background: currentTheme.bg,
              color: currentTheme.text,
              border: "1px solid #94a3b8",
            }}
          >
            <option value="light">Light</option>
            <option value="sepia">Warm Sepia</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {/* Reader Page Content */}
      <div
        style={{
          flex: 1,
          maxWidth: 780,
          margin: "0 auto",
          padding: "36px 24px",
          fontSize: `${fontSize}px`,
          lineHeight: 1.8,
          fontFamily: "Georgia, serif",
          width: "100%",
        }}
      >
        <div style={{ opacity: 0.6, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
          Section {page} of {totalPages}
        </div>

        <h2 style={{ marginBottom: 20, fontSize: "1.4em", fontFamily: "inherit" }}>
          {book?.title} — Chapter {page}
        </h2>

        <p style={{ marginBottom: 16 }}>
          {book?.description ||
            "Welcome to the digital reading edition. Enjoy seamless uninterrupted reading with adjustable font sizes and comfortable reading themes."}
        </p>

        <p style={{ marginBottom: 16 }}>
          This digital copy is authorized for active lease holders and permanent buyers. You can bookmark your progress and resume reading anytime from any device.
        </p>
      </div>

      {/* Bottom Page Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 24px",
          borderTop: `1px solid ${readerTheme === "dark" ? "#334155" : "#e2e8f0"}`,
          background: currentTheme.paper,
        }}
      >
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="btn btn-soft btn-sm"
        >
          ← Previous
        </button>

        <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
          Page {page} / {totalPages}
        </span>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="btn btn-soft btn-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}