import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenu, HiOutlineSun, HiOutlineMoon, HiOutlineLogout } from "react-icons/hi";

const Navbar = ({ onMenuClick }) => {
  const { currentUser, userProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 shadow-sm">
      <div className="flex items-center min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <HiOutlineMenu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </button>
        <h2 className="ml-2 lg:ml-0 text-xs sm:text-base md:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
          Library Management System
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === "dark" ? (
            <HiOutlineSun className="h-6 w-6 text-gray-300" />
          ) : (
            <HiOutlineMoon className="h-6 w-6 text-gray-600" />
          )}
        </button>

        <div className="hidden md:flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
            {userProfile?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {userProfile?.name || "User"}
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
  );
};

export default Navbar;
