import { BookIcon } from "./Icons";

const HIGHLIGHTS = [
  { title: "Instant Digital Reading", desc: "Start reading in seconds with our high-speed browser reader." },
  { title: "Rent or Buy Lifetime", desc: "Flexible credit rentals or full lifetime e-book ownership." },
  { title: "Distraction-Free Modes", desc: "Custom themes (Sepia, Dark, Night), adjustable font scaling & bookmarks." },
];

export default function AuthLayout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        flexWrap: "wrap",
        background: "var(--bg)",
      }}
    >
      {/* ── Left Editorial Showcase (Modern Obsidian & Aurora Mesh) ── */}
      <div
        style={{
          flex: "1 1 480px",
          background: "linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e1b4b 100%)",
          color: "#ffffff",
          padding: "64px 54px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle decorative glow circles */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 520, margin: "auto 0", position: "relative", zIndex: 2 }}>
          {/* Brand Mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            <span
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                color: "#ffffff",
                padding: "10px",
                borderRadius: 12,
                display: "inline-flex",
                boxShadow: "0 4px 16px rgba(99, 102, 241, 0.4)",
              }}
            >
              <BookIcon size={24} />
            </span>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.03em" }}>ReadHub</div>
              <div style={{ fontSize: "0.72rem", color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Next-Gen E-Book Store & Reader
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "2.8rem", fontWeight: 900, lineHeight: 1.15, marginBottom: 18, letterSpacing: "-0.03em" }}>
            The Modern Way to Discover & Read E-Books.
          </h1>

          <p style={{ fontSize: "1.1rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: 40 }}>
            Unlock bestsellers, rent for days, and read seamlessly in your browser across all devices with zero app installs.
          </p>

          {/* Highlights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {HIGHLIGHTS.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    background: "rgba(99, 102, 241, 0.2)",
                    border: "1px solid rgba(99, 102, 241, 0.4)",
                    color: "#818cf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note on left side */}
        <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 40, position: "relative", zIndex: 2 }}>
          Trusted by digital readers worldwide &bull; DRM protected e-book stream
        </div>
      </div>

      {/* ── Right Form Container ── */}
      <div
        style={{
          flex: "1 1 450px",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "54px 36px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
