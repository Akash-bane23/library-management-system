import { useState, useEffect } from "react";
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { authorsService } from "../services/firestore";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../utils/helpers";

const Authors = () => {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchAuthors = async () => {
    setLoading(true);
    try {
      const result = await authorsService.getAll();
      setAuthors(result.docs);
    } catch (error) {
      showToast("Error fetching authors: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Author name is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (selectedAuthor) {
        await authorsService.update(selectedAuthor.id, { name: name.trim() });
        showToast("Author updated successfully!");
      } else {
        await authorsService.create({ name: name.trim() });
        showToast("Author added successfully!");
      }
      setShowModal(false);
      setSelectedAuthor(null);
      setName("");
      fetchAuthors();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (author) => {
    setSelectedAuthor(author);
    setName(author.name);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedAuthor) return;
    try {
      await authorsService.delete(selectedAuthor.id);
      showToast("Author deleted successfully!");
      fetchAuthors();
    } catch (error) {
      showToast("Error deleting author: " + error.message, "error");
    }
  };

  if (loading) return <LoadingSpinner text="Loading authors..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Authors</h1>
          <p className="text-gray-500">Manage book authors</p>
        </div>
        <button
          onClick={() => {
            setSelectedAuthor(null);
            setName("");
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlinePlus className="h-5 w-5" />
          Add Author
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {authors.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">No authors yet. Add your first author.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-3 sm:px-6 py-3 font-medium">#</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Name</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Created</th>
                  <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {authors.map((author, index) => (
                  <tr key={author.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                          {author.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {author.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                      {formatDate(author.createdAt)}
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(author)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAuthor(author);
                            setShowDeleteDialog(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAuthor(null);
          setName("");
        }}
        title={selectedAuthor ? "Edit Author" : "Add Author"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Author Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter author name"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setSelectedAuthor(null);
                setName("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : selectedAuthor ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedAuthor(null);
        }}
        onConfirm={handleDelete}
        title="Delete Author"
        message="Are you sure you want to delete this author?"
      />
    </div>
  );
};

export default Authors;
