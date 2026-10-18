import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";

// Guards librarian-only routes. Access is granted only when the signed-in
// user's trusted Firestore profile has role === "librarian".
const LibrarianRoute = ({ children }) => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/librarian/login" replace />;
  }

  if (userProfile?.role !== "librarian") {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
};

export default LibrarianRoute;
