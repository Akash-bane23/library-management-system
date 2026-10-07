import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Books from "./pages/Books";
import Members from "./pages/Members";
import Students from "./pages/Students";
import Categories from "./pages/Categories";
import Authors from "./pages/Authors";
import IssueBook from "./pages/IssueBook";
import ReturnBook from "./pages/ReturnBook";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="books" element={<Books />} />
                <Route path="members" element={<Members />} />
                <Route path="students" element={<Students />} />
                <Route path="categories" element={<Categories />} />
                <Route path="authors" element={<Authors />} />
                <Route path="issue-book" element={<IssueBook />} />
                <Route path="return-book" element={<ReturnBook />} />
                <Route path="reports" element={<Reports />} />
              </Route>

              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
