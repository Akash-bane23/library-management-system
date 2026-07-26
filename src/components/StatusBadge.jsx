const StatusBadge = ({ status }) => {
  const statusConfig = {
    available: "bg-green-100 text-green-800",
    unavailable: "bg-red-100 text-red-800",
    maintenance: "bg-yellow-100 text-yellow-800",
    issued: "bg-blue-100 text-blue-800",
    returned: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    admin: "bg-purple-100 text-purple-800",
    librarian: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        statusConfig[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
