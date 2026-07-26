import { useState, useEffect } from "react";
import {
  HiOutlineBookOpen,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineClock,
} from "react-icons/hi";
import StatsCard from "../components/StatsCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { booksService, membersService, issuedBooksService } from "../services/firestore";
import { formatDate, isOverdue } from "../utils/helpers";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalMembers: 0,
    issuedBooks: 0,
    availableBooks: 0,
    overdueBooks: 0,
  });
  const [recentIssues, setRecentIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [booksResult, membersResult, issuedResult, overdueResult] =
          await Promise.all([
            booksService.getAll(),
            membersService.getAll(),
            issuedBooksService.getAll([], "createdAt", 10),
            issuedBooksService.getOverdue(),
          ]);

        const totalBooks = booksResult.docs.reduce(
          (sum, book) => sum + (book.quantity || 0),
          0
        );
        const availableBooks = booksResult.docs.reduce(
          (sum, book) => sum + (book.availableQuantity || 0),
          0
        );

        const activeIssues = issuedResult.docs.filter(
          (issue) => issue.status === "issued"
        );

        setStats({
          totalBooks,
          totalMembers: membersResult.docs.length,
          issuedBooks: activeIssues.length,
          availableBooks,
          overdueBooks: overdueResult.length,
        });

        setRecentIssues(issuedResult.docs);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Books"
          value={stats.totalBooks}
          icon={HiOutlineBookOpen}
          color="primary"
        />
        <StatsCard
          title="Total Members"
          value={stats.totalMembers}
          icon={HiOutlineUsers}
          color="green"
        />
        <StatsCard
          title="Books Issued"
          value={stats.issuedBooks}
          icon={HiOutlineClipboardList}
          color="blue"
        />
        <StatsCard
          title="Available Books"
          value={stats.availableBooks}
          icon={HiOutlineCheckCircle}
          color="green"
        />
        <StatsCard
          title="Overdue Books"
          value={stats.overdueBooks}
          icon={HiOutlineExclamationCircle}
          color="red"
        />
        <StatsCard
          title="Active Members"
          value={stats.totalMembers}
          icon={HiOutlineUsers}
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recently Issued Books</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="px-3 sm:px-6 py-3 font-medium">Book ID</th>
                <th className="px-3 sm:px-6 py-3 font-medium">Member ID</th>
                <th className="px-3 sm:px-6 py-3 font-medium">Issue Date</th>
                <th className="px-3 sm:px-6 py-3 font-medium">Due Date</th>
                <th className="px-3 sm:px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-8 text-center text-gray-500">
                    No recent issues found
                  </td>
                </tr>
              ) : (
                recentIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4 text-sm font-mono text-gray-900">
                      {issue.bookId?.substring(0, 8)}...
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm font-mono text-gray-900">
                      {issue.memberId?.substring(0, 8)}...
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                      {formatDate(issue.issueDate)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                      {formatDate(issue.dueDate)}
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          issue.status === "returned"
                            ? "bg-green-100 text-green-800"
                            : isOverdue(issue.dueDate)
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {issue.status === "returned"
                          ? "Returned"
                          : isOverdue(issue.dueDate)
                          ? "Overdue"
                          : "Issued"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
