import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import StatCard from "../components/StatCard";
import { BookIcon, IssueIcon, ClockIcon, RequestIcon } from "../components/Icons";

export default function LibrarianHome() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard")
      .then((res) => setStats(res.data))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <p className="empty">Loading admin store analytics...</p>;
  if (!stats) return <p className="empty">Could not load dashboard data.</p>;

  const { books, issues, purchaseRequests, recentIssues, overdueIssues } = stats;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Admin Analytics & Overview</h2>
          <p>Real-time overview of your digital book store, inventory, and sales performance.</p>
        </div>
      </div>

      {/* Modern E-Book Store Analytics Cards */}
      <div className="stat-grid">
        <StatCard
          icon={BookIcon}
          label="Total Inventory"
          value={books?.totalTitles || 0}
          hint={`${books?.totalTitles || 0} titles active in digital store`}
        />
        <StatCard
          icon={IssueIcon}
          label="Active Readers"
          value={issues?.issuedCount || 0}
          tone="success"
          hint="Currently active rental leases"
        />
        <StatCard
          icon={RequestIcon}
          label="Total Sales & Orders"
          value={purchaseRequests?.total || purchaseRequests?.approved || 0}
          tone="warning"
          hint="Completed rentals & purchases"
        />
        <StatCard
          icon={ClockIcon}
          label="Expired Passes"
          value={issues?.overdueCount || 0}
          tone="danger"
          hint="Rental passes expired"
        />
      </div>

      <div className="section-grid">
        {/* Recent Readers & Leases */}
        <div className="card">
          <div className="section-title">
            <h3>Recent Active Leases</h3>
            <Link to="/librarian/issues">View all</Link>
          </div>
          {(!recentIssues || recentIssues.length === 0) ? (
            <p className="empty">No recent reading activity recorded.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Reader</th>
                    <th>Valid Until</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIssues.slice(0, 5).map((i) => (
                    <tr key={i._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.book?.title}</div>
                        <span className="cell-sub">{i.book?.author}</span>
                      </td>
                      <td>
                        <div>{i.member?.name}</div>
                        <span className="cell-sub">{i.member?.email}</span>
                      </td>
                      <td>{formatDate(i.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expired Leases */}
        <div className="card">
          <div className="section-title">
            <h3>Expired Rental Passes</h3>
            <Link to="/librarian/issues">View all</Link>
          </div>
          {(!overdueIssues || overdueIssues.length === 0) ? (
            <p className="empty">No expired passes at this time.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Reader</th>
                    <th>Expired On</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueIssues.slice(0, 5).map((i) => (
                    <tr key={i._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.book?.title}</div>
                        <span className="cell-sub">{i.book?.author}</span>
                      </td>
                      <td>
                        <div>{i.member?.name}</div>
                        <span className="cell-sub">{i.member?.email}</span>
                      </td>
                      <td>
                        <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                          {formatDate(i.dueDate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}