import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineClipboardList } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import { booksService, membersService, issuedBooksService } from "../services/firestore";
import { useToast } from "../context/ToastContext";
import { getTodayISO, getDueDateISO } from "../utils/helpers";

const IssueBook = () => {
  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    bookId: "",
    memberId: "",
    issueDate: getTodayISO(),
    dueDate: getDueDateISO(14),
  });
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksResult, membersResult] = await Promise.all([
          booksService.getAll(),
          membersService.getAll(),
        ]);
        setBooks(booksResult.docs.filter((b) => b.availableQuantity > 0));
        setMembers(membersResult.docs);
      } catch (error) {
        showToast("Error fetching data: " + error.message, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bookId || !formData.memberId) {
      showToast("Please select both a book and a member", "error");
      return;
    }
    if (!formData.issueDate || !formData.dueDate) {
      showToast("Please select issue and due dates", "error");
      return;
    }
    if (new Date(formData.dueDate) <= new Date(formData.issueDate)) {
      showToast("Due date must be after issue date", "error");
      return;
    }

    setSubmitting(true);
    try {
      await issuedBooksService.create(formData);
      showToast("Book issued successfully!");
      navigate("/");
    } catch (error) {
      showToast("Error issuing book: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) return <LoadingSpinner text="Loading..." />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Issue Book</h1>
        <p className="text-gray-500 dark:text-gray-400">Issue a book to a member</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Member *
            </label>
            <select
              name="memberId"
              value={formData.memberId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Choose a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Book *
            </label>
            <select
              name="bookId"
              value={formData.bookId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Choose a book</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} by {book.author} (Available: {book.availableQuantity})
                </option>
              ))}
            </select>
            {books.length === 0 && (
              <p className="mt-1 text-sm text-red-500">No books available for issue</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Issue Date *
              </label>
              <input
                type="date"
                name="issueDate"
                value={formData.issueDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
                min={formData.issueDate}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <HiOutlineClipboardList className="h-5 w-5" />
              {submitting ? "Issuing..." : "Issue Book"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueBook;
