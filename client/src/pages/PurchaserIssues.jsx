import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "../components/ConfirmModal";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";

const TABS = [
  { key: "", label: "All Orders" },
  { key: "issued", label: "Active Rentals & Purchases" },
  { key: "returned", label: "Expired & Returned Rentals" },
];

export default function PurchaserIssues() {
  const toast = useToast();
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  // Early Return State
  const [returnTarget, setReturnTarget] = useState(null);
  const [returning, setReturning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/issues/my");
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReturnEarly = async () => {
    if (!returnTarget) return;
    setReturning(true);
    try {
      await api.patch(`/issues/${returnTarget._id}/return`);
      toast.success(
        `"${returnTarget.book?.title || 'Book'}" returned early. 1 rental slot has been freed up in your plan.`
      );
      // Real-time signal: sidebar quota and dashboard refresh instantly
      window.dispatchEvent(new Event("quota-updated"));
      setReturnTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReturning(false);
    }
  };

  const visible = issues.filter((i) => {
    if (tab === "issued") return i.status === "issued";
    if (tab === "returned") return i.status === "returned";
    return true;
  });

  const statusBadge = (i) => {
    if (i.status === "returned") {
      return (
        <span
          className="badge"
          style={{ background: "var(--soft)", color: "var(--muted)", border: "1px solid var(--border)", fontWeight: 600 }}
        >
          Returned / Expired
        </span>
      );
    }
    if (i.digitalPlan === "lifetime") {
      return (
        <span
          className="badge"
          style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 700 }}
        >
          Lifetime Owned
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", fontWeight: 700 }}
      >
        Active Rental
      </span>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Library & Purchases</h2>
          <p>Your purchased e-books and active digital rental plans.</p>
        </div>
        <Link to="/purchaser/books" className="btn">
          Explore Store
        </Link>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">Loading your purchases and rentals...</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: 16 }}>
            No rented or purchased books yet.
          </p>
          <Link to="/purchaser/books" className="btn">
            Browse Store to Rent or Buy
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Access Plan</th>
                <th>Acquired On</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => {
                const isLifetime = i.digitalPlan === "lifetime";
                const isActiveRental = i.status === "issued" && !isLifetime;

                return (
                  <tr key={i._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{i.book?.title || "Book"}</div>
                      <span className="cell-sub">{i.book?.author}</span>
                    </td>

                    <td>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          background: isLifetime ? "#ecfdf5" : "#eef2ff",
                          color: isLifetime ? "#047857" : "#4338ca",
                        }}
                      >
                        {isLifetime ? "Lifetime Purchase" : `${i.digitalPlan?.toUpperCase()} Rental`}
                      </span>
                    </td>

                    <td>{formatDate(i.issueDate)}</td>

                    <td>
                      {isLifetime ? (
                        <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.84rem" }}>
                          Lifetime Access
                        </span>
                      ) : (
                        formatDate(i.dueDate)
                      )}
                    </td>

                    <td>{statusBadge(i)}</td>

                    <td style={{ textAlign: "right" }}>
                      {isActiveRental ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-soft"
                          onClick={() => setReturnTarget(i)}
                          title="Return early to free up a rental slot in your plan"
                          style={{
                            fontSize: "0.78rem",
                            padding: "4px 10px",
                            fontWeight: 600,
                          }}
                        >
                          Return Early
                        </button>
                      ) : isLifetime ? (
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 500 }}>
                          Permanent
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 500 }}>
                          Closed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal for Returning Early */}
      {returnTarget && (
        <ConfirmModal
          title="Return Rental Early"
          message={`Are you sure you want to return "${returnTarget.book?.title || 'this book'}" early? This will end your active rental and immediately free up 1 rental slot in your plan so you can rent other titles. Note: Rental fee is non-refundable.`}
          confirmText="Return & Free Slot"
          cancelText="Keep Reading"
          loading={returning}
          onClose={() => setReturnTarget(null)}
          onConfirm={handleReturnEarly}
        />
      )}
    </>
  );
}