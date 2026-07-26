import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenu, HiOutlineBell, HiOutlineLogout } from "react-icons/hi";

const Navbar = ({ onMenuClick }) => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shadow-sm">
      <div className="flex items-center min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <HiOutlineMenu className="h-6 w-6 text-gray-600" />
        </button>
        <h2 className="ml-2 lg:ml-0 text-xs sm:text-base md:text-lg font-semibold text-gray-800 truncate">
          Library Management System
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <HiOutlineBell className="h-6 w-6 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="hidden md:flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
            {userProfile?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {userProfile?.name || "User"}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <HiOutlineLogout className="h-5 w-5" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
