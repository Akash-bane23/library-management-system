import { Link } from "react-router-dom";
import { HiOutlineHome } from "react-icons/hi";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl sm:text-9xl font-bold text-primary-600">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-900">Page Not Found</h2>
        <p className="mt-2 text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <HiOutlineHome className="h-5 w-5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
