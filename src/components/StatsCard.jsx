const StatsCard = ({ title, value, icon: Icon, color = "primary", change, changeType }) => {
  const colorClasses = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <p
              className={`mt-1 text-sm ${
                changeType === "increase" ? "text-green-600" : "text-red-600"
              }`}
            >
              {changeType === "increase" ? "+" : "-"}{change} from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
