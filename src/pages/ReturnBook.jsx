import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import { booksService, membersService, issuedBooksService } from "../services/firestore";
import { useToast } from "../context/ToastContext";
import { formatDate, calculateFine, isOverdue, getTodayISO, formatCurrency } from "../utils/helpers";

const ReturnBook = () => {
  const [issuedBooks, setIssuedBooks] = useState([]);
  const [books, setBooks] = useState({});
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchIssuedBooks = async () => {
    setLoading(true);
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

      const activeIssues = issuedResult.docs.filter(
        (issue) => issue.status === "issued"
      );
      setIssuedBooks(activeIssues);
    } catch (error) {
      showToast("Error fetching data: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssuedBooks();
  }, []);

  const handleReturn = async (issue) => {
    setReturning(issue.id);
    try {
      const fine = calculateFine(issue.dueDate);
      await issuedBooksService.returnBook(issue.id, fine);
      if (fine > 0) {
        showToast(`Book returned with fine of ${formatCurrency(fine)}`, "error");
      } else {
        showToast("Book returned successfully!");
      }
      fetchIssuedBooks();
    } catch (error) {
      showToast("Error returning book: " + error.message, "error");
    } finally {
      setReturning(null);
    }
  };

  if (loading) return <LoadingSpinner text="Loading issued books..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Return Book</h1>
        <p className="text-gray-500 dark:text-gray-400">Process book returns</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {issuedBooks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No books currently issued</p>
          </div>
        ) : (
          <div className="sm:overflow-x-auto">
            <table className="w-full">
              <thead className="hidden sm:table-header-group">
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 sm:px-6 py-3 font-medium">Book</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Student</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Issue Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Due Date</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Fine</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                {issuedBooks.map((issue) => {
                  const book = books[issue.bookId];
                  const member = members[issue.memberId];
                  const overdue = isOverdue(issue.dueDate);
                  const fine = calculateFine(issue.dueDate);

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
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {member?.email || ""}
                        </p>
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Issue Date
                        </span>
                        {formatDate(issue.issueDate)}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Due Date
                        </span>
                        <p
                          className={`text-sm ${
                            overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {formatDate(issue.dueDate)}
                        </p>
                        {overdue && (
                          <p className="text-xs text-red-500">Overdue</p>
                        )}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Fine
                        </span>
                        {fine > 0 ? (
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            {formatCurrency(fine)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Actions
                        </span>
                        <button
                          onClick={() => handleReturn(issue)}
                          disabled={returning === issue.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <HiOutlineArrowLeft className="h-4 w-4" />
                          {returning === issue.id ? "Returning..." : "Return"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnBook;
