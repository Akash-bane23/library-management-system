import { useEffect, useState } from "react";
import { HiOutlineX } from "react-icons/hi";

const Modal = ({ isOpen, onClose, title, children, size = "md" }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      setTimeout(() => setShow(false), 300);
    }
  }, [isOpen]);

  if (!show) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} transform transition-all ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <HiOutlineX className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
