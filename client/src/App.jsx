import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import DeleteAccountConfirm from "./pages/DeleteAccountConfirm";
import Profile from "./pages/Profile";

// Admin / Librarian Pages
import LibrarianHome from "./pages/LibrarianHome";
import LibrarianBooks from "./pages/LibrarianBooks";
import LibrarianIssues from "./pages/LibrarianIssues";
import LibrarianRequests from "./pages/LibrarianRequests";
import LibrarianUsers from "./pages/LibrarianUsers";
import LibrarianSupport from "./pages/LibrarianSupport";

// Reader / Purchaser Pages
import PurchaserHome from "./pages/PurchaserHome";
import PurchaserBooks from "./pages/PurchaserBooks";
import PurchaserIssues from "./pages/PurchaserIssues";
import PurchaserRequests from "./pages/PurchaserRequests";
import PurchaserSupport from "./pages/PurchaserSupport";
import Wishlist from "./pages/Wishlist";

// Dedicated In-Browser Book Reader
import BookReader from "./pages/BookReader";

function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={user.role === "librarian" ? "/librarian" : "/purchaser"}
      replace
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/delete-account-confirm" element={<DeleteAccountConfirm />} />

      {/* Dedicated In-Browser Book Reader (Protected) */}
      <Route element={<ProtectedRoute roles={["purchaser", "librarian"]} />}>
        <Route path="/read/:id" element={<BookReader />} />
      </Route>

      {/* Admin / Librarian Group */}
      <Route element={<ProtectedRoute roles={["librarian"]} />}>
        <Route path="/librarian" element={<AppLayout />}>
          <Route index element={<LibrarianHome />} />
          <Route path="books" element={<LibrarianBooks />} />
          <Route path="issues" element={<LibrarianIssues />} />
          <Route path="requests" element={<LibrarianRequests />} />
          <Route path="users" element={<LibrarianUsers />} />
          <Route path="support" element={<LibrarianSupport />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Reader / Purchaser Group */}
      <Route element={<ProtectedRoute roles={["purchaser"]} />}>
        <Route path="/purchaser" element={<AppLayout />}>
          <Route index element={<PurchaserHome />} />
          <Route path="books" element={<PurchaserBooks />} />
          <Route path="my-issues" element={<PurchaserIssues />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="requests" element={<PurchaserRequests />} />
          <Route path="support" element={<PurchaserSupport />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}