const StatusBadge = ({ status }) => {
  const statusConfig = {
    available: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    unavailable: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    maintenance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    issued: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    returned: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    librarian: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    disabled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        statusConfig[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
