const EmptyState = ({ icon: Icon, title, message, action, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          {action}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
