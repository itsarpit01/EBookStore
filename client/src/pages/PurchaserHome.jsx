import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { SERVER_URL } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import MembershipModal from "../components/MembershipModal";
import { BookIcon, RequestIcon, IssueIcon } from "../components/Icons";

export default function PurchaserHome() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tier = getEffectiveTier(user);

  const [loading, setLoading] = useState(true);
  const [latestBooks, setLatestBooks] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [lifetimeCount, setLifetimeCount] = useState(0);
  const [userCredits, setUserCredits] = useState(user?.credits ?? 100);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [booksRes, ordersRes, shelfRes] = await Promise.all([
        api.get("/books", { params: { limit: 5, sort: "-createdAt" } }),
        api.get("/purchase-requests/my"),
        api.get("/books/my-digital-shelf").catch(() => ({ data: { credits: user?.credits ?? 100, digitalShelf: [] } })),
      ]);

      setLatestBooks(booksRes.data?.data || []);
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      setRecentOrders(allOrders.slice(0, 4));

      const shelf = shelfRes.data?.digitalShelf || [];
      if (shelfRes.data?.credits !== undefined) {
        setUserCredits(shelfRes.data.credits);
      }

      const active = shelf.filter((item) => {
        if (item.plan === "lifetime" || !item.expiresAt) return false;
        return new Date(item.expiresAt) > new Date();
      });
      const lifetime = shelf.filter((item) => item.plan === "lifetime" || !item.expiresAt);

      setActiveRentals(active);
      setLifetimeCount(lifetime.length);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Welcome Banner */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.03))",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: "1.5rem" }}>
              Welcome back, {user?.name || "Reader"}!
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
              Browse the store, rent or buy e-books, and manage your active digital passes.
            </p>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => setShowUpgradeModal(true)}
            style={{
              background:
                tier.tier === "ultimate"
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : tier.tier === "premium"
                  ? "linear-gradient(135deg, #6366f1, #4338ca)"
                  : "var(--surface)",
              color: tier.tier === "free" ? "var(--text)" : "#fff",
              border: tier.tier === "free" ? "1px solid var(--border)" : "none",
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: 20,
            }}
          >
            {tier.badge} Pass • {userCredits} Credits Available
          </button>
        </div>

        {/* Store Metrics Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          <div
            className="card"
            style={{ padding: 14, cursor: "pointer" }}
            onClick={() => navigate("/purchaser/my-issues")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--primary)" }}><IssueIcon size={20} /></span>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600 }}>Active Rentals</span>
            </div>
            <strong style={{ fontSize: "1.5rem", display: "block", marginTop: 4 }}>
              {activeRentals.length}
            </strong>
          </div>

          <div
            className="card"
            style={{ padding: 14, cursor: "pointer" }}
            onClick={() => navigate("/purchaser/my-issues")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#10b981" }}><BookIcon size={20} /></span>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600 }}>Lifetime Owned</span>
            </div>
            <strong style={{ fontSize: "1.5rem", display: "block", marginTop: 4 }}>
              {lifetimeCount}
            </strong>
          </div>

          <div
            className="card"
            style={{ padding: 14, cursor: "pointer" }}
            onClick={() => navigate("/purchaser/requests")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#f59e0b" }}><RequestIcon size={20} /></span>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600 }}>Total Orders</span>
            </div>
            <strong style={{ fontSize: "1.5rem", display: "block", marginTop: 4 }}>
              {recentOrders.length}
            </strong>
          </div>

          <div
            className="card"
            style={{ padding: 14, cursor: "pointer", background: "var(--soft)" }}
            onClick={() => navigate("/purchaser/books")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--primary)" }}><BookIcon size={20} /></span>
              <span style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 700 }}>Explore Store</span>
            </div>
            <strong style={{ fontSize: "1.1rem", display: "block", marginTop: 8, color: "var(--primary)" }}>
              Browse E-Books →
            </strong>
          </div>
        </div>
      </div>

      {/* Latest Books in Store */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>New Releases in Store</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Recently published e-books available for rent or purchase.
            </span>
          </div>
          <button className="btn btn-soft btn-sm" onClick={() => navigate("/purchaser/books")}>
            Explore all books →
          </button>
        </div>

        {loading ? (
          <p className="empty">Loading latest arrivals...</p>
        ) : latestBooks.length === 0 ? (
          <p className="empty">No books available in the store yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 16,
            }}
          >
            {latestBooks.map((b) => (
              <div
                key={b._id}
                className="card"
                onClick={() => navigate("/purchaser/books")}
                style={{
                  cursor: "pointer",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.15s ease",
                }}
              >
                <div
                  style={{
                    height: 140,
                    borderRadius: 8,
                    background: "var(--primary-gradient)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    marginBottom: 10,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "2rem",
                  }}
                >
                  {b.coverImage ? (
                    <img
                      src={`${SERVER_URL}${b.coverImage}`}
                      alt={b.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    b.title?.[0]?.toUpperCase()
                  )}
                </div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.title}>
                  {b.title}
                </h4>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  by {b.author}
                </span>
               <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <div>
    <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text)" }}>₹{b.price}</span>
    <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: 4 }}>Lifetime</span>
  </div>
  <span style={{ fontSize: "0.74rem", color: "var(--primary)", fontWeight: 700 }}>
    Rent from ₹{b.rentalPlans?.day?.inr || 20}
  </span>
</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Orders & Purchases */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Recent Orders & Receipts</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Your latest e-book transactions and access passes.
            </span>
          </div>
          <button className="btn btn-soft btn-sm" onClick={() => navigate("/purchaser/requests")}>
            View all orders →
          </button>
        </div>

        {loading ? (
          <p className="empty">Loading orders...</p>
        ) : recentOrders.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ margin: "0 0 12px 0", color: "var(--muted)" }}>
              You haven&apos;t rented or purchased any books yet.
            </p>
            <button className="btn btn-sm" onClick={() => navigate("/purchaser/books")}>
              Browse Store to Rent or Buy
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>E-Book Title</th>
                  <th>Order Date</th>
                  <th>Plan & Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <strong>{r.title}</strong>
                      <span className="cell-sub">{r.author}</span>
                    </td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      <span className="badge" style={{ background: "var(--soft)", color: "var(--primary)" }}>
                        {r.reason || "Digital Access"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}