import { Link, useNavigate } from "react-router-dom";
import { HiOutlineShieldExclamation, HiOutlineHome, HiOutlineLogout } from "react-icons/hi";
import { useAuth } from "../context/AuthContext";

const AccessDenied = () => {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 mb-4">
          <HiOutlineShieldExclamation className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Access Denied
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {userProfile?.role
            ? `Your account role ("${userProfile.role}") does not have permission to open the librarian dashboard.`
            : "You do not have permission to open the librarian dashboard."}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <HiOutlineHome className="h-5 w-5" />
            Go to Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            <HiOutlineLogout className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
