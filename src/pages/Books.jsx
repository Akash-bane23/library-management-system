import { useState, useEffect } from "react";
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { booksService, categoriesService, authorsService } from "../services/firestore";
import { useToast } from "../context/ToastContext";
import { usePagination, useSearch } from "../hooks/useFirestore";

const initialBookState = {
  isbn: "",
  title: "",
  author: "",
  category: "",
  publisher: "",
  quantity: 1,
  shelfNumber: "",
  status: "available",
};

const Books = () => {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [formData, setFormData] = useState(initialBookState);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { showToast } = useToast();

  const { searchTerm, setSearchTerm, filteredItems } = useSearch(books, [
    "title",
    "author",
    "isbn",
    "publisher",
    "category",
  ]);

  const appliedFilters = filteredItems.filter((book) => {
    if (filterCategory && book.category !== filterCategory) return false;
    if (filterStatus && book.status !== filterStatus) return false;
    return true;
  });

  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(appliedFilters);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksResult, categoriesResult, authorsResult] = await Promise.all([
        booksService.getAll(),
        categoriesService.getAll(),
        authorsService.getAll(),
      ]);
      setBooks(booksResult.docs);
      setCategories(categoriesResult.docs);
      setAuthors(authorsResult.docs);
    } catch (error) {
      showToast("Error fetching data: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.isbn) {
      showToast("Title and ISBN are required", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (selectedBook) {
        await booksService.update(selectedBook.id, formData);
        showToast("Book updated successfully!");
      } else {
        await booksService.create(formData);
        showToast("Book added successfully!");
      }
      setShowModal(false);
      setSelectedBook(null);
      setFormData(initialBookState);
      fetchData();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (book) => {
    setSelectedBook(book);
    setFormData({
      isbn: book.isbn || "",
      title: book.title || "",
      author: book.author || "",
      category: book.category || "",
      publisher: book.publisher || "",
      quantity: book.quantity || 1,
      shelfNumber: book.shelfNumber || "",
      status: book.status || "available",
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedBook) return;
    try {
      await booksService.delete(selectedBook.id);
      showToast("Book deleted successfully!");
      fetchData();
    } catch (error) {
      showToast("Error deleting book: " + error.message, "error");
    }
  };

  const openAddModal = () => {
    setSelectedBook(null);
    setFormData(initialBookState);
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner text="Loading books..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Books</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your library collection</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlinePlus className="h-5 w-5" />
          Add Book
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by title, author, ISBN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <EmptyState
            icon={HiOutlineSearch}
            title="No books found"
            message="Add your first book to get started"
            action="Add Book"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="sm:overflow-x-auto">
              <table className="w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 sm:px-6 py-3 font-medium">ISBN</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Title</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Author</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Category</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Qty</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Available</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Shelf</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Status</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                  {paginatedItems.map((book) => (
                    <tr
                      key={book.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                    >
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm font-mono text-gray-900 dark:text-gray-100">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          ISBN
                        </span>
                        {book.isbn}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Title
                        </span>
                        {book.title}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Author
                        </span>
                        {book.author}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Category
                        </span>
                        {book.category}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-900 dark:text-gray-100">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Qty
                        </span>
                        {book.quantity}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-900 dark:text-gray-100">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Available
                        </span>
                        {book.availableQuantity}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Shelf
                        </span>
                        {book.shelfNumber}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Status
                        </span>
                        <StatusBadge status={book.status} />
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Actions
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(book)}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                          >
                            <HiOutlinePencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBook(book);
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
        onClose={() => {
          setShowModal(false);
          setSelectedBook(null);
          setFormData(initialBookState);
        }}
        title={selectedBook ? "Edit Book" : "Add Book"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ISBN *</label>
              <input
                type="text"
                name="isbn"
                value={formData.isbn}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter ISBN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Author</label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter author"
                list="authors-list"
              />
              <datalist id="authors-list">
                {authors.map((a) => (
                  <option key={a.id} value={a.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publisher</label>
              <input
                type="text"
                name="publisher"
                value={formData.publisher}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter publisher"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shelf Number</label>
              <input
                type="text"
                name="shelfNumber"
                value={formData.shelfNumber}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. A-12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setSelectedBook(null);
                setFormData(initialBookState);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : selectedBook ? "Update" : "Add Book"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedBook(null);
        }}
        onConfirm={handleDelete}
        title="Delete Book"
        message="Are you sure you want to delete this book? This action cannot be undone."
      />
    </div>
  );
};

export default Books;
