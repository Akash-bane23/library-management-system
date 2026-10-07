import { useState, useEffect } from "react";
import { HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineExclamationCircle } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import { booksService, membersService, issuedBooksService } from "../services/firestore";
import { formatDate, isOverdue, calculateFine, formatCurrency } from "../utils/helpers";

const Reports = () => {
  const [activeTab, setActiveTab] = useState("issued");
  const [issuedBooks, setIssuedBooks] = useState([]);
  const [books, setBooks] = useState({});
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [issuedResult, booksResult, membersResult] = await Promise.all([
          issuedBooksService.getAll([], "issueDate"),
          booksService.getAll(),
          membersService.getAll(),
        ]);

        const booksMap = {};
        booksResult.docs.forEach((b) => {
          booksMap[b.id] = b;
        });

        const membersMap = {};
        membersResult.docs.forEach((m) => {
          membersMap[m.id] = m;
        });

        setBooks(booksMap);
        setMembers(membersMap);
        setIssuedBooks(issuedResult.docs);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Loading reports..." />;

  const issued = issuedBooks.filter((i) => i.status === "issued");
  const returned = issuedBooks.filter((i) => i.status === "returned");
  const overdue = issuedBooks.filter((i) => i.status === "issued" && isOverdue(i.dueDate));

  const tabs = [
    { id: "issued", label: "Issued Books", count: issued.length, icon: HiOutlineDocumentText },
    { id: "returned", label: "Returned Books", count: returned.length, icon: HiOutlineCheckCircle },
    { id: "overdue", label: "Overdue Books", count: overdue.length, icon: HiOutlineExclamationCircle },
  ];

  const getReportData = () => {
    switch (activeTab) {
      case "issued":
        return issued;
      case "returned":
        return returned;
      case "overdue":
        return overdue;
      default:
        return [];
    }
  };

  const reportData = getReportData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400">View library reports and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              activeTab === tab.id
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  activeTab === tab.id
                    ? "bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                <tab.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">{tab.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">{tab.count}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-3 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white capitalize">
            {activeTab} Books Report
          </h3>
        </div>
        <div className="sm:overflow-x-auto">
          {reportData.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No records found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="hidden sm:table-header-group">
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 sm:px-6 py-3 font-medium">Book</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Student</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Issue Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Due Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Return Date</th>
                  {activeTab === "overdue" && (
                    <th className="px-3 sm:px-6 py-3 font-medium">Fine</th>
                  )}
                  <th className="px-3 sm:px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                {reportData.map((issue) => {
                  const book = books[issue.bookId];
                  const member = members[issue.memberId];

                  return (
                    <tr
                      key={issue.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                    >
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
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
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Student
                        </span>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {member?.name || "Unknown Student"}
                        </p>
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Issue Date
                        </span>
                        {formatDate(issue.issueDate)}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Due Date
                        </span>
                        {formatDate(issue.dueDate)}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Return Date
                        </span>
                        {issue.returnDate ? formatDate(issue.returnDate) : "-"}
                      </td>
                      {activeTab === "overdue" && (
                        <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm font-medium text-red-600">
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                            Fine
                          </span>
                          {formatCurrency(calculateFine(issue.dueDate))}
                        </td>
                      )}
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Status
                        </span>
                          <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            issue.status === "returned"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              : isOverdue(issue.dueDate)
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
