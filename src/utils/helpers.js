export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const FINE_PER_DAY = 10;

export const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

export const calculateFine = (dueDate, returnDate = null) => {
  const due = new Date(dueDate);
  const returned = returnDate ? new Date(returnDate) : new Date();
  const diffTime = returned - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 0;
  return diffDays * FINE_PER_DAY;
};

export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

export const getDaysOverdue = (dueDate) => {
  if (!isOverdue(dueDate)) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((today - due) / (1000 * 60 * 60 * 24));
};

export const getTodayISO = () => {
  return new Date().toISOString().split("T")[0];
};

export const getDueDateISO = (days = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

export const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validateISBN = (isbn) => {
  return /^\d{10}(\d{3})?$/.test(isbn.replace(/[-\s]/g, ""));
};

export const STATUS_OPTIONS = [
  { value: "available", label: "Available", color: "text-green-600 bg-green-100" },
  { value: "unavailable", label: "Unavailable", color: "text-red-600 bg-red-100" },
  { value: "maintenance", label: "Maintenance", color: "text-yellow-600 bg-yellow-100" },
];

export const ISSUE_STATUS_OPTIONS = [
  { value: "issued", label: "Issued", color: "text-blue-600 bg-blue-100" },
  { value: "returned", label: "Returned", color: "text-green-600 bg-green-100" },
  { value: "overdue", label: "Overdue", color: "text-red-600 bg-red-100" },
];

export const ITEMS_PER_PAGE = 10;
