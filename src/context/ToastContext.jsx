import { createContext, useContext, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const showToast = useCallback((message, type = "success") => {
    switch (type) {
      case "success":
        toast.success(message);
        break;
      case "error":
        toast.error(message);
        break;
      case "loading":
        toast.loading(message);
        break;
      default:
        toast(message);
    }
  }, []);

  const promise = useCallback((promiseFn, messages) => {
    return toast.promise(promiseFn, {
      loading: messages.loading || "Loading...",
      success: messages.success || "Success!",
      error: messages.error || "Something went wrong!",
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, promise }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: "#22c55e",
              secondary: "#fff",
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
      {children}
    </ToastContext.Provider>
  );
};

export default ToastContext;
