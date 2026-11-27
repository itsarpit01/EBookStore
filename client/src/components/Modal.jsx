import { useEffect } from "react";
import { CloseIcon } from "./Icons";

export default function Modal({ title, onClose, maxWidth, style, footer, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{
          ...(maxWidth ? { maxWidth, width: "95vw" } : {}),
          padding: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
          ...style,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── 1. FIXED TOP HEADER (Close button fixed) ── */}
        <div
          className="modal-head"
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            margin: 0,
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{title}</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              cursor: "pointer",
              padding: 6,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── 2. SCROLLABLE MIDDLE BODY (Only fields scroll) ── */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          {children}
        </div>

        {/* ── 3. FIXED BOTTOM FOOTER (Buttons permanently pinned) ── */}
        {footer && (
          <div
            className="modal-footer"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              zIndex: 10,
              boxShadow: "0 -4px 14px rgba(0, 0, 0, 0.04)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}