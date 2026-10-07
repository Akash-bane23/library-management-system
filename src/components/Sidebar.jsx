import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HiOutlineHome,
  HiOutlineBookOpen,
  HiOutlineUsers,
  HiOutlineCollection,
  HiOutlineUserGroup,
  HiOutlineDocumentText,
  HiOutlineClipboardList,
  HiOutlineArrowLeft,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineAcademicCap,
} from "react-icons/hi";

const Sidebar = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();

  const menuItems = [
    { path: "/", label: "Dashboard", icon: HiOutlineHome },
    { path: "/books", label: "Books", icon: HiOutlineBookOpen },
    { path: "/members", label: "Members", icon: HiOutlineUsers },
    { path: "/students", label: "Students", icon: HiOutlineAcademicCap },
    { path: "/categories", label: "Categories", icon: HiOutlineCollection },
    { path: "/authors", label: "Authors", icon: HiOutlineUserGroup },
    { path: "/issue-book", label: "Issue Book", icon: HiOutlineClipboardList },
    { path: "/return-book", label: "Return Book", icon: HiOutlineArrowLeft },
    { path: "/reports", label: "Reports", icon: HiOutlineChartBar },
  ];

  if (userProfile?.role === "admin") {
    menuItems.push({ path: "/settings", label: "Settings", icon: HiOutlineCog });
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-white transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-center h-16 border-b border-slate-600">
          <HiOutlineBookOpen className="h-8 w-8 text-primary-400" />
          <span className="ml-2 text-xl font-bold">LMS</span>
        </div>

        <nav className="mt-6 px-3">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 mb-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-primary-600 text-white shadow-lg"
                    : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                }`
              }
            >
              <item.icon className="h-5 w-5 mr-3" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-600">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
              {userProfile?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{userProfile?.name || "User"}</p>
              <p className="text-xs text-slate-400 capitalize">{userProfile?.role || "Librarian"}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
