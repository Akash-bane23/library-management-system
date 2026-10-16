import { useState, useEffect, useMemo } from "react";
import {
  HiOutlineBookOpen,
  HiOutlineClock,
  HiOutlineCurrencyRupee,
  HiOutlineSearch,
  HiOutlineUser,
  HiOutlineCollection,
  HiOutlineExclamation,
  HiOutlineCheckCircle,
  HiOutlineKey,
} from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../firebase/config";

import {
  booksService,
  membersService,
  issuedBooksService,
} from "../services/firestore";
import {
  formatDate,
  formatCurrency,
  isOverdue,
  calculateFine,
  getDaysOverdue,
} from "../utils/helpers";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

const TABS = [
  { id: "overview", label: "My Issued Books", icon: HiOutlineClock },
  { id: "books", label: "Available Books", icon: HiOutlineBookOpen },
  { id: "history", label: "My History", icon: HiOutlineClock },
  { id: "fines", label: "My Fines", icon: HiOutlineCurrencyRupee },
  { id: "profile", label: "My Profile", icon: HiOutlineUser },
];

const StudentDashboard = () => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const memberId = userProfile?.memberId;

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [member, setMember] = useState(null);

  const [bookSearch, setBookSearch] = useState("");

  const [profileForm, setProfileForm] = useState({ name: "", phone: "", address: "" });
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [booksResult, issuesResult] = await Promise.all([
          booksService.getAll(),
          memberId
            ? issuedBooksService.getAll([
                { field: "memberId", operator: "==", value: memberId },
              ])
            : Promise.resolve({ docs: [] }),
        ]);

        if (!active) return;

        setBooks(booksResult.docs || []);
        setIssues(issuesResult.docs || []);

        if (memberId) {
          const memberDoc = await membersService.getById(memberId);
          if (!active) return;
          setMember(memberDoc);
          setProfileForm({
            name: memberDoc?.name || userProfile?.name || "",
            phone: memberDoc?.phone || "",
            address: memberDoc?.address || "",
          });
        } else {
          setProfileForm({
            name: userProfile?.name || "",
            phone: "",
            address: "",
          });
        }
      } catch (error) {
        if (active) {
          showToast(
            "Unable to load your library data. Please refresh and try again.",
            "error"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const booksById = useMemo(() => {
    const map = {};
    books.forEach((book) => {
      map[book.id] = book;
    });
    return map;
  }, [books]);

  const issueRows = useMemo(
    () =>
      issues.map((issue) => {
        const book = booksById[issue.bookId];
        const overdue = issue.status === "issued" && isOverdue(issue.dueDate);
        const outstandingFine =
          issue.status === "returned"
            ? issue.fine || 0
            : overdue
            ? calculateFine(issue.dueDate)
            : 0;
        return {
          ...issue,
          book,
          title: book?.title || "Unknown title",
          author: book?.author || "",
          overdue,
          daysOverdue: overdue ? getDaysOverdue(issue.dueDate) : 0,
          outstandingFine,
          paid: issue.finePaid === true,
        };
      }),
    [issues, booksById]
  );

  const activeIssues = useMemo(
    () => issueRows.filter((row) => row.status === "issued"),
    [issueRows]
  );

  const returnedIssues = useMemo(
    () => issueRows.filter((row) => row.status === "returned"),
    [issueRows]
  );

  const fineRows = useMemo(
    () => issueRows.filter((row) => row.outstandingFine > 0),
    [issueRows]
  );

  const totalFine = useMemo(
    () =>
      fineRows.reduce(
        (sum, row) => sum + (row.paid ? 0 : row.outstandingFine),
        0
      ),
    [fineRows]
  );

  const availableBooks = useMemo(() => {
    const term = bookSearch.trim().toLowerCase();
    return books
      .filter((book) => (book.availableQuantity || 0) > 0)
      .filter((book) => {
        if (!term) return true;
        return (
          book.title?.toLowerCase().includes(term) ||
          book.author?.toLowerCase().includes(term) ||
          book.isbn?.toLowerCase().includes(term) ||
          book.category?.toLowerCase().includes(term)
        );
      });
  }, [books, bookSearch]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!memberId) return;
    setSavingProfile(true);
    try {
      await membersService.update(memberId, {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
      });
      setMember((prev) => ({
        ...prev,
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
      }));
      showToast("Profile updated successfully!");
    } catch (error) {
      showToast("Could not update your profile. Please try again.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your library account..." />;
  }

  const handlePwdChange = (e) => {
    const { name, value } = e.target;
    setPwdForm((prev) => ({ ...prev, [name]: value }));
    setPwdError("");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError("");
    if (!pwdForm.currentPassword) {
      setPwdError("Please enter your current password.");
      return;
    }
    if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("New passwords do not match.");
      return;
    }
    setChangingPwd(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Session expired. Please log in again.");
      const cred = EmailAuthProvider.credential(user.email, pwdForm.currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwdForm.newPassword);
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("Password changed successfully!");
    } catch (error) {
      let msg = error?.message || "Password change failed. Please try again.";
      if (error?.code === "auth/wrong-password") msg = "Current password is incorrect.";
      if (error?.code === "auth/too-many-requests") msg = "Too many attempts. Please try again later.";
      setPwdError(msg);
      showToast(msg, "error");
    } finally {
      setChangingPwd(false);
    }
  };

  const notLinked = !memberId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome{userProfile?.name ? `, ${userProfile.name}` : ""}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Track your issued books, due dates and fines.
        </p>
      </div>

      {notLinked && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/20 p-4">
          <HiOutlineExclamation className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Your account is not linked to a student record.
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Please contact the library staff to complete your account setup.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Issued Books</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeIssues.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <HiOutlineClock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Returned Books</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {returnedIssues.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <HiOutlineCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {overdueIssues.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <HiOutlineExclamation className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Fines</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalFine)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <HiOutlineCurrencyRupee className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Available Books
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {books.filter((book) => (book.availableQuantity || 0) > 0).length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <HiOutlineCollection className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === item.id
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Currently Issued Books
            </h2>
          </div>
          {activeIssues.length === 0 ? (
            <EmptyState
              icon={HiOutlineBookOpen}
              title="No issued books"
              message="You have no books issued right now."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {activeIssues.map((row) => (
                <li key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {row.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {row.author}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>Issued: {formatDate(row.issueDate)}</span>
                      <span>Due: {formatDate(row.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {row.overdue ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Overdue {row.daysOverdue}d
                      </span>
                    ) : (
                      <StatusBadge status="issued" />
                    )}
                    {row.overdue && (
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(row.outstandingFine)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "books" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by title, author, ISBN or category..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {availableBooks.length === 0 ? (
            <EmptyState
              icon={HiOutlineBookOpen}
              title="No available books"
              message={
                bookSearch
                  ? "No books match your search."
                  : "There are no books available to borrow right now."
              }
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {availableBooks.map((book) => (
                <li
                  key={book.id}
                  className="p-4 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {book.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {book.author || "Unknown author"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {book.isbn && <span>ISBN: {book.isbn}</span>}
                      {book.category && <span>{book.category}</span>}
                      {book.shelf && <span>Shelf: {book.shelf}</span>}
                    </div>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    {book.availableQuantity} available
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "fines" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              My Fines
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Outstanding balance: {formatCurrency(totalFine)}
            </p>
          </div>
          {fineRows.length === 0 ? (
            <EmptyState
              icon={HiOutlineCheckCircle}
              title="No fines"
              message="You have no outstanding fines. Keep returning books on time!"
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {fineRows.map((row) => (
                <li
                  key={row.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {row.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>Due: {formatDate(row.dueDate)}</span>
                      {row.status === "returned" ? (
                        <span>Returned: {formatDate(row.returnDate)}</span>
                      ) : (
                        <span>Overdue by {row.daysOverdue} day(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(row.outstandingFine)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.paid
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {row.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "profile" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              My Profile
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can update your name, phone number and address.
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 break-all">
                  {userProfile?.email || member?.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Student ID
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {member?.studentId || userProfile?.studentId || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Class / Department
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {member?.className || "—"}
                </dd>
              </div>
            </dl>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={notLinked}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-60"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    disabled={notLinked}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-60"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    disabled={notLinked}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-60"
                    placeholder="Enter address"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile || notLinked}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
