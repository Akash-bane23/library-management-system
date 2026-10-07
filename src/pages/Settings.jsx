import { useState, useEffect } from "react";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineKey,
  HiOutlineEyeOff,
  HiOutlineEye,
  HiOutlineShieldCheck,
} from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { usersService } from "../services/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useSearch, usePagination } from "../hooks/useFirestore";
import { formatDate, validateEmail } from "../utils/helpers";

const initialFormState = { name: "", email: "", password: "", role: "librarian" };

const AUTH_ERROR_MESSAGES = {
  "auth/email-already-in-use":
    "This email is already registered. Use a different email or ask them to log in.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/operation-not-allowed":
    "Email/Password sign-in is disabled in the Firebase console.",
  "permission-denied":
    "Firestore security rules blocked this write. Only admins can manage the users collection.",
};

const resolveErrorMessage = (error) =>
  AUTH_ERROR_MESSAGES[error?.code] || error?.message || "Something went wrong.";

const Settings = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const { searchTerm, setSearchTerm, filteredItems } = useSearch(users, [
    "name",
    "email",
  ]);
  const { paginatedItems, currentPage, totalPages, goToPage } =
    usePagination(filteredItems);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await usersService.getAll([], "createdAt");
      setUsers(result.docs);
    } catch (error) {
      showToast("Error fetching staff: " + resolveErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAdminCount = users.filter(
    (u) => u.role === "admin" && u.status !== "disabled"
  ).length;

  const isLastActiveAdmin = (user) =>
    user?.role === "admin" &&
    user?.status !== "disabled" &&
    activeAdminCount <= 1;

  const isSelf = (user) => user?.id === currentUser?.uid;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setSelectedUser(null);
    setFormData(initialFormState);
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "librarian",
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast("Name is required", "error");
      return;
    }

    if (selectedUser) {
      if (isSelf(selectedUser) && formData.role !== selectedUser.role) {
        showToast("You cannot change your own role", "error");
        return;
      }
      if (
        selectedUser.role === "admin" &&
        formData.role !== "admin" &&
        isLastActiveAdmin(selectedUser)
      ) {
        showToast(
          "This is the last active admin — promote another admin first",
          "error"
        );
        return;
      }

      setSubmitting(true);
      try {
        await usersService.updateProfile(selectedUser.id, {
          name: formData.name.trim(),
          role: formData.role,
        });
        showToast("Staff member updated!");
        closeModal();
        fetchUsers();
      } catch (error) {
        showToast("Error: " + resolveErrorMessage(error), "error");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateEmail(formData.email)) {
      showToast("Enter a valid email address", "error");
      return;
    }
    if (formData.password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    setSubmitting(true);
    try {
      await usersService.createStaff({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });
      showToast(`${formData.role === "admin" ? "Admin" : "Librarian"} account created!`);
      closeModal();
      fetchUsers();
    } catch (error) {
      showToast("Error: " + resolveErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setSubmitting(true);
    try {
      if (type === "disable") {
        await usersService.setStatus(user.id, "disabled");
        showToast(`${user.name} has been disabled and signed out.`);
      } else if (type === "enable") {
        await usersService.setStatus(user.id, "active");
        showToast(`${user.name} has been re-enabled.`);
      } else if (type === "delete") {
        await usersService.deleteProfile(user.id);
        showToast(`${user.name} can no longer sign in.`);
      }
      setConfirmAction(null);
      fetchUsers();
    } catch (error) {
      showToast("Error: " + resolveErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const requestStatusToggle = (user) => {
    if (isSelf(user)) {
      showToast("You cannot disable your own account", "error");
      return;
    }
    if (user.status !== "disabled" && isLastActiveAdmin(user)) {
      showToast("The last active admin cannot be disabled", "error");
      return;
    }
    setConfirmAction({
      type: user.status === "disabled" ? "enable" : "disable",
      user,
    });
  };

  const requestDelete = (user) => {
    if (isSelf(user)) {
      showToast("You cannot delete your own account", "error");
      return;
    }
    if (isLastActiveAdmin(user)) {
      showToast("The last active admin cannot be deleted", "error");
      return;
    }
    setConfirmAction({ type: "delete", user });
  };

  const handleResetPassword = async (user) => {
    setResettingId(user.id);
    try {
      await usersService.sendPasswordReset(user.email);
      showToast(`Password reset email sent to ${user.email}`);
    } catch (error) {
      showToast("Error: " + resolveErrorMessage(error), "error");
    } finally {
      setResettingId(null);
    }
  };

  if (loading) return <LoadingSpinner text="Loading staff..." />;

  const confirmCopy = confirmAction
    ? {
        disable: {
          title: "Disable Account",
          message: `${confirmAction.user.name} will be signed out and blocked from logging in until re-enabled.`,
        },
        enable: {
          title: "Enable Account",
          message: `${confirmAction.user.name} will be able to sign in again.`,
        },
        delete: {
          title: "Delete Staff Profile",
          message: `${confirmAction.user.name} will lose access to the app. Their Firebase auth email stays registered, so use a different email if you recreate this account.`,
        },
      }[confirmAction.type]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage staff accounts, roles and access
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlinePlus className="h-5 w-5" />
          Add Staff Member
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {users.length} staff member{users.length === 1 ? "" : "s"}
          </p>
        </div>

        {paginatedItems.length === 0 ? (
          <EmptyState
            icon={HiOutlineShieldCheck}
            title="No staff found"
            message="Add your first librarian to get started."
            action="Add Staff Member"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="sm:overflow-x-auto">
              <table className="w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 sm:px-6 py-3 font-medium">Staff</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Role</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Status</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Joined</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                  {paginatedItems.map((user) => {
                    const self = isSelf(user);
                    const disabled = user.status === "disabled";
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                      >
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Staff
                          </span>
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                              {user.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="ml-3 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {user.name}
                                {self && (
                                  <span className="ml-2 text-xs font-medium text-primary-600 dark:text-primary-400">
                                    (You)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Role
                          </span>
                          <StatusBadge status={user.role} />
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Status
                          </span>
                          <StatusBadge status={disabled ? "disabled" : "active"} />
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Joined
                          </span>
                          {formatDate(user.joinedAt || user.createdAt)}
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden mb-1">
                            Actions
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => openEditModal(user)}
                              title="Edit name or role"
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                            >
                              <HiOutlinePencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={resettingId === user.id}
                              title="Send password reset email"
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <HiOutlineKey className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => requestStatusToggle(user)}
                              disabled={self}
                              title={
                                disabled ? "Enable account" : "Disable account"
                              }
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors disabled:opacity-40 disabled:hover:text-gray-500"
                            >
                              {disabled ? (
                                <HiOutlineEye className="h-4 w-4" />
                              ) : (
                                <HiOutlineEyeOff className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => requestDelete(user)}
                              disabled={self}
                              title="Delete staff profile"
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40 disabled:hover:text-gray-500"
                            >
                              <HiOutlineTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={selectedUser ? "Edit Staff Member" : "Add Staff Member"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter full name"
            />
          </div>

          {!selectedUser && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password * (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 pr-10 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <HiOutlineEyeOff className="h-5 w-5" />
                    ) : (
                      <HiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              disabled={isSelf(selectedUser)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="librarian">Librarian — day-to-day operations</option>
              <option value="admin">Admin — full access incl. settings</option>
            </select>
            {isSelf(selectedUser) && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You cannot change your own role.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : selectedUser
                ? "Update"
                : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmCopy?.title || ""}
        message={confirmCopy?.message || ""}
        confirmText={
          confirmAction?.type === "delete"
            ? "Delete"
            : confirmAction?.type === "enable"
            ? "Enable"
            : "Disable"
        }
        confirmVariant={confirmAction?.type === "enable" ? "primary" : "danger"}
      />
    </div>
  );
};

export default Settings;
