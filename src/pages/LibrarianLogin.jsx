import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiOutlineBookOpen,
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineShieldExclamation,
  HiOutlineCheckCircle,
} from "react-icons/hi";
import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usersService } from "../services/firestore";
import { validateEmail } from "../utils/helpers";

const getLoginErrorMessage = (error) => {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password. Please try again.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is disabled. Contact your administrator.";
    default:
      return error?.message || "Login failed. Please try again.";
  }
};

const LibrarianLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { login, logout, currentUser, userProfile, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && currentUser && userProfile?.role === "librarian") {
      navigate("/librarian/dashboard", { replace: true });
    }
  }, [loading, currentUser, userProfile, navigate]);

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!validateEmail(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    let credential = null;
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );

      credential = await login(email.trim(), password);

      const profile = await usersService.getById(credential.user.uid);

      if (!profile) {
        await logout();
        setError(
          "Access denied. Your account has no staff profile. Contact your administrator."
        );
        setSubmitting(false);
        return;
      }

      if (profile.status === "disabled") {
        await logout();
        setError("This account has been disabled. Contact your administrator.");
        setSubmitting(false);
        return;
      }

      if (profile.role !== "librarian") {
        await logout();
        setError(
          "Access denied. This account is not registered as a librarian. Please use the correct login page."
        );
        setSubmitting(false);
        return;
      }

      showToast(`Welcome back, ${profile.name || "Librarian"}!`);
      navigate("/librarian/dashboard", { replace: true });
    } catch (err) {
      if (credential) {
        try {
          await logout();
        } catch {
          /* session already cleared */
        }
      }
      setError(getLoginErrorMessage(err));
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError("");
    if (!validateEmail(resetEmail.trim())) {
      setResetError("Please enter a valid email address.");
      return;
    }

    setResetting(true);
    try {
      await usersService.sendPasswordReset(resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      if (
        err?.code === "auth/user-not-found" ||
        err?.code === "auth/invalid-credential"
      ) {
        // Do not reveal whether the email belongs to an account.
        setResetSent(true);
      } else if (err?.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else if (err?.code === "auth/too-many-requests") {
        setResetError("Too many requests. Please try again later.");
      } else {
        setResetError("Could not send the reset email. Please try again.");
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/40 mb-4">
              <HiOutlineBookOpen className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Librarian Login
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sign in to manage library operations.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-3">
              <HiOutlineShieldExclamation className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {showReset ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {resetSent ? (
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20 p-3">
                  <HiOutlineCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    If an account exists for{" "}
                    <span className="font-medium">{resetEmail}</span>, a password
                    reset link has been sent. Check your inbox and spam folder.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Enter your registered email and we'll send you a link to
                    reset your password.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                        placeholder="name@library.com"
                      />
                    </div>
                    {resetError && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {resetError}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {!resetSent && (
                  <button
                    type="submit"
                    disabled={resetting}
                    className="w-full py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? "Sending..." : "Send Reset Link"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(false);
                    setResetSent(false);
                    setResetError("");
                  }}
                  className="w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {resetSent ? "Back to Login" : "Cancel"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="name@library.com"
                    autoComplete="email"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <HiOutlineEyeOff className="h-5 w-5" />
                    ) : (
                      <HiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(true);
                    setResetEmail(email);
                    setError("");
                  }}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 space-y-2 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Admin account?{" "}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Sign in here
              </Link>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Student?{" "}
              <Link
                to="/student/login"
                className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Sign in here
              </Link>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Librarian accounts are created by an administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibrarianLogin;
