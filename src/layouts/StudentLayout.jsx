import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  HiOutlineBookOpen,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineLogout,
} from "react-icons/hi";

// Simple shell for the student area. Students do not get the staff sidebar.
const StudentLayout = () => {
  const { userProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/student/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 shadow-sm">
        <div className="flex items-center min-w-0">
          <HiOutlineBookOpen className="h-7 w-7 text-primary-600 dark:text-primary-400 flex-shrink-0" />
          <div className="ml-2 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 truncate">
              Student Portal
            </h1>
            <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 truncate">
              Library Management System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === "dark" ? (
              <HiOutlineSun className="h-5 w-5 text-gray-300" />
            ) : (
              <HiOutlineMoon className="h-5 w-5 text-gray-600" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
              {userProfile?.name?.charAt(0)?.toUpperCase() || "S"}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[10rem] truncate">
              {userProfile?.name || "Student"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <HiOutlineLogout className="h-5 w-5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;
