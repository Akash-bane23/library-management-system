import { useState, useEffect } from "react";
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { categoriesService } from "../services/firestore";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../utils/helpers";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const result = await categoriesService.getAll();
      setCategories(result.docs);
    } catch (error) {
      showToast("Error fetching categories: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Category name is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (selectedCategory) {
        await categoriesService.update(selectedCategory.id, { name: name.trim() });
        showToast("Category updated successfully!");
      } else {
        await categoriesService.create({ name: name.trim() });
        showToast("Category added successfully!");
      }
      setShowModal(false);
      setSelectedCategory(null);
      setName("");
      fetchCategories();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setName(category.name);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      await categoriesService.delete(selectedCategory.id);
      showToast("Category deleted successfully!");
      fetchCategories();
    } catch (error) {
      showToast("Error deleting category: " + error.message, "error");
    }
  };

  if (loading) return <LoadingSpinner text="Loading categories..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500">Manage book categories</p>
        </div>
        <button
          onClick={() => {
            setSelectedCategory(null);
            setName("");
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlinePlus className="h-5 w-5" />
          Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {categories.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">No categories yet. Add your first category.</p>
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
                {categories.map((category, index) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                      {category.name}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                      {formatDate(category.createdAt)}
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCategory(category);
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
          setSelectedCategory(null);
          setName("");
        }}
        title={selectedCategory ? "Edit Category" : "Add Category"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter category name"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setSelectedCategory(null);
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
              {submitting ? "Saving..." : selectedCategory ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedCategory(null);
        }}
        onConfirm={handleDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
      />
    </div>
  );
};

export default Categories;
