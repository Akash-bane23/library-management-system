import { useState, useEffect } from "react";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineClipboardCopy,
  HiOutlinePrinter,
  HiOutlineKey,
  HiOutlineIdentification,
} from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import { membersService } from "../services/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePagination, useSearch } from "../hooks/useFirestore";
import {
  formatDate,
  validateEmail,
  validateMobile,
  normalizeMobile,
} from "../utils/helpers";

const initialStudentState = {
  name: "",
  studentId: "",
  className: "",
  email: "",
  phone: "",
  address: "",
};

const Members = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [formData, setFormData] = useState(initialStudentState);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loginInfo, setLoginInfo] = useState(null);
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const canProvision =
    userProfile?.role === "admin" || userProfile?.role === "librarian";

  const { searchTerm, setSearchTerm, filteredItems } = useSearch(members, [
    "name",
    "email",
    "phone",
    "studentId",
    "className",
  ]);

  const { paginatedItems, currentPage, totalPages, goToPage } =
    usePagination(filteredItems);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const result = await membersService.getAll();
      setMembers(result.docs);
    } catch (error) {
      showToast("Error fetching students: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Full name is required.";
    if (!formData.email.trim()) {
      errors.email = "Email is required.";
    } else if (!validateEmail(formData.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!formData.phone.trim()) {
      errors.phone = "Mobile number is required (used as the initial password).";
    } else if (!validateMobile(formData.phone)) {
      errors.phone = "Enter a valid mobile number (10–13 digits).";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Creates the student record AND provisions the login account on the server.
  const provisionStudent = async () => {
    if (!currentUser) {
      throw new Error("Your session has expired. Please sign in again.");
    }
    const token = await currentUser.getIdToken();

    let response;
    try {
      response = await fetch("/api/create-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          className: formData.className.trim(),
          address: formData.address.trim(),
        }),
      });
    } catch {
      throw new Error(
        "Could not reach the account service. Check your connection, or run the app with `vercel dev` locally."
      );
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      if (payload?.fieldErrors) setFieldErrors(payload.fieldErrors);
      const message =
        payload?.error ||
        (response.status === 404
          ? "The account service was not found. If you are running locally, start the app with `vercel dev`."
          : "Could not create the student account. Please try again.");
      throw new Error(message);
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (selectedMember) {
        // Editing profile details only — never touches the login account.
        await membersService.update(selectedMember.id, {
          name: formData.name.trim(),
          className: formData.className.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
        });
        showToast("Student updated successfully!");
      } else {
        if (!canProvision) {
          throw new Error("You do not have permission to create student accounts.");
        }
        const result = await provisionStudent();
        // The mobile number is the initial password (temporary credential).
        setLoginInfo({
          name: result.name,
          studentId: result.studentId,
          password: normalizeMobile(formData.phone),
          email: result.email,
        });
        showToast("Student added and login account created!");
      }
      setShowModal(false);
      setSelectedMember(null);
      setFormData(initialStudentState);
      setFieldErrors({});
      fetchMembers();
    } catch (error) {
      showToast(
        "Error: " + (error.message || "Something went wrong."),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (member) => {
    setSelectedMember(member);
    setFieldErrors({});
    setFormData({
      name: member.name || "",
      studentId: member.studentId || "",
      className: member.className || "",
      email: member.email || "",
      phone: member.phone || member.mobile || "",
      address: member.address || "",
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    try {
      await membersService.delete(selectedMember.id);
      showToast("Student deleted successfully!");
      fetchMembers();
    } catch (error) {
      showToast("Error deleting student: " + error.message, "error");
    }
  };

  const openAddModal = () => {
    setSelectedMember(null);
    setFormData(initialStudentState);
    setFieldErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMember(null);
    setFormData(initialStudentState);
    setFieldErrors({});
  };

  const handlePrint = () => {
    if (!loginInfo) return;
    const win = window.open("", "_blank", "width=640,height=720");
    if (!win) {
      showToast("Please allow pop-ups to print login details.", "error");
      return;
    }
    const loginPath = `${window.location.origin}/student/login`;
    win.document.write(`
      <html>
        <head>
          <title>Student Login Details</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .muted { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
            .row { margin: 10px 0; font-size: 15px; }
            .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
            .value { font-size: 18px; font-weight: 700; }
            .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 8px; }
            .note { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>Library Management System</h1>
          <p class="muted">Student login details</p>
          <div class="row"><div class="label">Student Name</div><div class="value">${loginInfo.name}</div></div>
          <div class="box">
            <div class="row"><div class="label">Student ID (Login ID)</div><div class="value">${loginInfo.studentId}</div></div>
            <div class="row"><div class="label">Initial Password</div><div class="value">${loginInfo.password}</div></div>
            <div class="row"><div class="label">Login Page</div><div class="value">${loginPath}</div></div>
          </div>
          <p class="note">
            The initial password is your registered mobile number and is a
            temporary credential. Please change it after your first login from
            My Profile &rarr; Change Password.
          </p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleCopyDetails = async () => {
    if (!loginInfo) return;
    const text = `Student ID: ${loginInfo.studentId}\nPassword: ${loginInfo.password}\nLogin: ${window.location.origin}/student/login`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Login details copied to clipboard.");
    } catch {
      showToast("Could not copy. Please copy manually.", "error");
    }
  };

  if (loading) return <LoadingSpinner text="Loading students..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Students</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Add a student and a login account is created automatically
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlinePlus className="h-5 w-5" />
          Add Student
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, student ID, class, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <EmptyState
            icon={HiOutlineSearch}
            title="No students found"
            message="Add your first student to get started"
            action="Add Student"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 sm:px-6 py-3 font-medium">Student</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Student ID</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Class</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Phone</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Joined</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                  {paginatedItems.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                    >
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Student
                        </span>
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                            {member.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="ml-3 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Student ID
                        </span>
                        {member.studentId || (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Class
                        </span>
                        {member.className || (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Phone
                        </span>
                        {member.phone || member.mobile || "-"}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Joined
                        </span>
                        {formatDate(member.joinedAt || member.createdAt)}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Actions
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(member)}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                          >
                            <HiOutlinePencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowDeleteDialog(true);
                            }}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <HiOutlineTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        title={selectedMember ? "Edit Student" : "Add Student"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Basic Information
          </p>
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
              placeholder="Enter student full name"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Student ID
              </label>
              <input
                type="text"
                value={formData.studentId || "Auto-generated"}
                readOnly
                disabled
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-300 cursor-not-allowed"
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Class / Department
              </label>
              <input
                type="text"
                name="className"
                value={formData.className}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. 10th / B.Sc IT"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="10-digit mobile number"
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter address"
            />
          </div>

          {!selectedMember && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 p-3">
              <HiOutlineKey className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                A unique Student ID will be generated automatically. The student
                logs in with that ID and this mobile number as the initial
                (temporary) password.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                ? selectedMember
                  ? "Saving..."
                  : "Creating account..."
                : selectedMember
                ? "Update"
                : "Add Student"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!loginInfo}
        onClose={() => setLoginInfo(null)}
        title="Student Added Successfully"
      >
        {loginInfo && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <HiOutlineCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {loginInfo.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  A login account has been created for this student.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  <HiOutlineIdentification className="h-4 w-4" />
                  Student ID (Login ID)
                </div>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {loginInfo.studentId}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  <HiOutlineKey className="h-4 w-4" />
                  Initial Password
                </div>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {loginInfo.password}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              The initial password is the student's registered mobile number and
              is a temporary credential. Ask the student to change it after the
              first login from My Profile &rarr; Change Password.
            </p>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCopyDetails}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <HiOutlineClipboardCopy className="h-5 w-5" />
                Copy
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <HiOutlinePrinter className="h-5 w-5" />
                Print
              </button>
              <button
                type="button"
                onClick={() => setLoginInfo(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedMember(null);
        }}
        onConfirm={handleDelete}
        title="Delete Student"
        message="Are you sure you want to delete this student? This action cannot be undone."
      />
    </div>
  );
};

export default Members;
