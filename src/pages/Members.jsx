import { useState, useEffect } from "react";
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch } from "react-icons/hi";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import { membersService } from "../services/firestore";
import { useToast } from "../context/ToastContext";
import { usePagination, useSearch } from "../hooks/useFirestore";
import { formatDate } from "../utils/helpers";

const initialMemberState = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

const Members = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [formData, setFormData] = useState(initialMemberState);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const { searchTerm, setSearchTerm, filteredItems } = useSearch(members, [
    "name",
    "email",
    "phone",
  ]);

  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filteredItems);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const result = await membersService.getAll();
      setMembers(result.docs);
    } catch (error) {
      showToast("Error fetching members: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showToast("Name and email are required", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (selectedMember) {
        await membersService.update(selectedMember.id, formData);
        showToast("Member updated successfully!");
      } else {
        await membersService.create(formData);
        showToast("Member added successfully!");
      }
      setShowModal(false);
      setSelectedMember(null);
      setFormData(initialMemberState);
      fetchMembers();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      address: member.address || "",
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    try {
      await membersService.delete(selectedMember.id);
      showToast("Member deleted successfully!");
      fetchMembers();
    } catch (error) {
      showToast("Error deleting member: " + error.message, "error");
    }
  };

  const openAddModal = () => {
    setSelectedMember(null);
    setFormData(initialMemberState);
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner text="Loading members..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Members</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage library members</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlinePlus className="h-5 w-5" />
          Add Member
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <EmptyState
            icon={HiOutlineSearch}
            title="No members found"
            message="Add your first member to get started"
            action="Add Member"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="sm:overflow-x-auto">
              <table className="w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 sm:px-6 py-3 font-medium">Name</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Email</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Phone</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Address</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Joined</th>
                    <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                  {paginatedItems.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                    >
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Name
                        </span>
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm">
                            {member.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {member.name}
                          </span>
                        </div>
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Email
                        </span>
                        {member.email}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Phone
                        </span>
                        {member.phone}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Address
                        </span>
                        {member.address}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Joined
                        </span>
                        {formatDate(member.joinedAt || member.createdAt)}
                      </td>
                      <td className="block sm:table-cell px-3 sm:px-6 py-1.5 sm:py-4">
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                          Actions
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(member)}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                          >
                            <HiOutlinePencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
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
          setSelectedMember(null);
          setFormData(initialMemberState);
        }}
        title={selectedMember ? "Edit Member" : "Add Member"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter address"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setSelectedMember(null);
                setFormData(initialMemberState);
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
              {submitting ? "Saving..." : selectedMember ? "Update" : "Add Member"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedMember(null);
        }}
        onConfirm={handleDelete}
        title="Delete Member"
        message="Are you sure you want to delete this member? This action cannot be undone."
      />
    </div>
  );
};

export default Members;
