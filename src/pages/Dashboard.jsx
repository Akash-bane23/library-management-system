import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBookOpen,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineArrowLeft,
  HiOutlineChartBar,
  HiOutlineChevronRight,
} from "react-icons/hi";
import StatsCard from "../components/StatsCard";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  booksService,
  membersService,
  issuedBooksService,
} from "../services/firestore";
import {
  formatDate,
  isOverdue,
  calculateFine,
  formatCurrency,
  getDaysOverdue,
} from "../utils/helpers";
import { useAuth } from "../context/AuthContext";

const getStatusMeta = (issue) => {
  if (issue.status === "returned") {
    return { label: "Returned", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
  }
  if (isOverdue(issue.dueDate)) {
    return { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  }
  return { label: "Issued", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
};

const Dashboard = () => {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalMembers: 0,
    issuedBooks: 0,
    availableBooks: 0,
    overdueBooks: 0,
    returnedBooks: 0,
  });
  const [recentIssues, setRecentIssues] = useState([]);
  const [overdueIssues, setOverdueIssues] = useState([]);
  const [booksMap, setBooksMap] = useState({});
  const [membersMap, setMembersMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [booksResult, membersResult, issuedResult, overdueResult] =
          await Promise.all([
            booksService.getAll(),
            membersService.getAll(),
            issuedBooksService.getAll([], "createdAt", 8),
            issuedBooksService.getOverdue(),
          ]);

        const bMap = {};
        booksResult.docs.forEach((b) => {
          bMap[b.id] = b;
        });
        const mMap = {};
        membersResult.docs.forEach((m) => {
          mMap[m.id] = m;
        });
        setBooksMap(bMap);
        setMembersMap(mMap);

        const totalBooks = booksResult.docs.reduce(
          (sum, book) => sum + (book.quantity || 0),
          0
        );
        const availableBooks = booksResult.docs.reduce(
          (sum, book) => sum + (book.availableQuantity || 0),
          0
        );

        const allIssued = issuedResult.docs;
        const activeIssues = allIssued.filter((i) => i.status === "issued");
        const returnedIssues = allIssued.filter((i) => i.status === "returned");

        setStats({
          totalBooks,
          totalMembers: membersResult.docs.length,
          issuedBooks: activeIssues.length,
          availableBooks,
          overdueBooks: overdueResult.length,
          returnedBooks: returnedIssues.length,
        });

        setRecentIssues(allIssued);
        setOverdueIssues(overdueResult.docs.slice(0, 6));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const quickActions = [
    { to: "/issue-book", label: "Issue Book", icon: HiOutlineClipboardList, primary: true },
    { to: "/return-book", label: "Return Book", icon: HiOutlineArrowLeft, primary: false },
    { to: "/reports", label: "Reports", icon: HiOutlineChartBar, primary: false },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {greeting}, {userProfile?.name || "Librarian"}!
            </h1>
            <p className="mt-1 text-sm text-primary-100">{today}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  action.primary
                    ? "bg-white text-primary-700 hover:bg-primary-50"
                    : "bg-white/15 text-white hover:bg-white/25 border border-white/20"
                }`}
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          title="Total Books"
          value={stats.totalBooks}
          icon={HiOutlineBookOpen}
          color="primary"
        />
        <StatsCard
          title="Students"
          value={stats.totalMembers}
          icon={HiOutlineUsers}
          color="purple"
        />
        <StatsCard
          title="Issued"
          value={stats.issuedBooks}
          icon={HiOutlineClipboardList}
          color="blue"
        />
        <StatsCard
          title="Available"
          value={stats.availableBooks}
          icon={HiOutlineCheckCircle}
          color="green"
        />
        <StatsCard
          title="Overdue"
          value={stats.overdueBooks}
          icon={HiOutlineExclamationCircle}
          color="red"
        />
        <StatsCard
          title="Returned"
          value={stats.returnedBooks}
          icon={HiOutlineArrowLeft}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all
              <HiOutlineChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="sm:overflow-x-auto">
            <table className="w-full">
              <thead className="hidden sm:table-header-group">
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 sm:px-6 py-3 font-medium">Book</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Student</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Due Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                {recentIssues.length === 0 ? (
                  <tr className="block sm:table-row">
                    <td
                      colSpan={4}
                      className="block sm:table-cell px-3 sm:px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No activity yet. Issue your first book to get started.
                    </td>
                  </tr>
                ) : (
                  recentIssues.map((issue) => {
                    const book = booksMap[issue.bookId];
                    const member = membersMap[issue.memberId];
                    const status = getStatusMeta(issue);

                    return (
                      <tr
                        key={issue.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                      >
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Book
                          </span>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {book?.title || "Unknown Book"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {book?.author || ""}
                          </p>
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Student
                          </span>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {member?.name || "Unknown Student"}
                          </p>
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Due Date
                          </span>
                          {formatDate(issue.dueDate)}
                        </td>
                        <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Status
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Overdue Books
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
              {stats.overdueBooks}
            </span>
          </div>
          {overdueIssues.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <HiOutlineCheckCircle className="mx-auto h-10 w-10 text-green-500" />
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                All caught up!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No overdue books right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {overdueIssues.map((issue) => {
                const book = booksMap[issue.bookId];
                const member = membersMap[issue.memberId];
                const daysLate = getDaysOverdue(issue.dueDate);

                return (
                  <li key={issue.id} className="px-4 sm:px-6 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {book?.title || "Unknown Book"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {member?.name || "Unknown Student"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(calculateFine(issue.dueDate))}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {daysLate} day{daysLate === 1 ? "" : "s"} late
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
