import { useState, useEffect } from "react";
import { HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineExclamationCircle } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import { booksService, membersService, issuedBooksService } from "../services/firestore";
import { formatDate, isOverdue, calculateFine } from "../utils/helpers";

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
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">View library reports and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              activeTab === tab.id
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  activeTab === tab.id
                    ? "bg-primary-100 text-primary-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <tab.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-600">{tab.label}</p>
                <p className="text-2xl font-bold text-gray-900">{tab.count}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-3 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {activeTab} Books Report
          </h3>
        </div>
        <div className="overflow-x-auto">
          {reportData.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No records found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-3 sm:px-6 py-3 font-medium">Book</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Member</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Issue Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Due Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Return Date</th>
                  {activeTab === "overdue" && (
                    <th className="px-3 sm:px-6 py-3 font-medium">Fine</th>
                  )}
                  <th className="px-3 sm:px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.map((issue) => {
                  const book = books[issue.bookId];
                  const member = members[issue.memberId];

                  return (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {book?.title || "Unknown Book"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {book?.author || ""}
                        </p>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {member?.name || "Unknown Member"}
                        </p>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                        {formatDate(issue.issueDate)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                        {formatDate(issue.dueDate)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                        {issue.returnDate ? formatDate(issue.returnDate) : "-"}
                      </td>
                      {activeTab === "overdue" && (
                        <td className="px-3 sm:px-6 py-4 text-sm font-medium text-red-600">
                          ${calculateFine(issue.dueDate).toFixed(2)}
                        </td>
                      )}
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
