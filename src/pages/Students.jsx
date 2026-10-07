import { useState, useEffect, useMemo } from "react";
import {
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineCurrencyRupee,
  HiOutlineSearch,
  HiOutlineClock,
} from "react-icons/hi";
import StatsCard from "../components/StatsCard";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import StatusBadge from "../components/StatusBadge";
import {
  booksService,
  membersService,
  issuedBooksService,
} from "../services/firestore";
import { useSearch, usePagination } from "../hooks/useFirestore";
import {
  formatDate,
  isOverdue,
  calculateFine,
  formatCurrency,
} from "../utils/helpers";

const Students = () => {
  const [members, setMembers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [booksMap, setBooksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [historyMember, setHistoryMember] = useState(null);
  const { searchTerm, setSearchTerm, filteredItems } = useSearch(members, [
    "name",
    "email",
    "phone",
  ]);
  const { paginatedItems, currentPage, totalPages, goToPage } =
    usePagination(filteredItems);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersResult, issuesResult, booksResult] = await Promise.all([
          membersService.getAll(),
          issuedBooksService.getAll([], "issueDate"),
          booksService.getAll(),
        ]);
        setMembers(membersResult.docs);
        setIssues(issuesResult.docs);
        const bMap = {};
        booksResult.docs.forEach((b) => {
          bMap[b.id] = b;
        });
        setBooksMap(bMap);
      } catch (error) {
        console.error("Error fetching students data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const memberStats = useMemo(() => {
    const map = {};
    issues.forEach((issue) => {
      if (!map[issue.memberId]) {
        map[issue.memberId] = { total: 0, holding: 0, overdue: 0, fine: 0 };
      }
      const s = map[issue.memberId];
      s.total += 1;
      if (issue.status === "issued") {
        s.holding += 1;
        if (isOverdue(issue.dueDate)) {
          s.overdue += 1;
          s.fine += calculateFine(issue.dueDate);
        }
      } else {
        s.fine += issue.fine || 0;
      }
    });
    return map;
  }, [issues]);

  const overall = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let returned = 0;
    let totalFine = 0;
    issues.forEach((issue) => {
      if (issue.status === "returned") {
        returned += 1;
        totalFine += issue.fine || 0;
      } else {
        active += 1;
        if (isOverdue(issue.dueDate)) {
          overdue += 1;
          totalFine += calculateFine(issue.dueDate);
        }
      }
    });
    return { active, overdue, returned, totalFine };
  }, [issues]);

  const topBorrowers = useMemo(() => {
    return members
      .map((m) => ({ ...m, ...(memberStats[m.id] || { total: 0, holding: 0, overdue: 0, fine: 0 }) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [members, memberStats]);

  const memberHistory = useMemo(() => {
    if (!historyMember) return [];
    return issues
      .filter((i) => i.memberId === historyMember.id)
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }, [issues, historyMember]);

  if (loading) return <LoadingSpinner text="Loading students..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Students
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Library members, borrowing activity and dues
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard
          title="Total Students"
          value={members.length}
          icon={HiOutlineUsers}
          color="primary"
        />
        <StatsCard
          title="Books Issued"
          value={overall.active}
          icon={HiOutlineClipboardList}
          color="blue"
        />
        <StatsCard
          title="Overdue"
          value={overall.overdue}
          icon={HiOutlineExclamationCircle}
          color="red"
        />
        <StatsCard
          title="Returned"
          value={overall.returned}
          icon={HiOutlineCheckCircle}
          color="green"
        />
        <StatsCard
          title="Fine Collected"
          value={formatCurrency(overall.totalFine)}
          icon={HiOutlineCurrencyRupee}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
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
              icon={HiOutlineUsers}
              title="No students found"
              message="Add members from the Members page to see them here."
            />
          ) : (
            <>
              <div className="sm:overflow-x-auto">
                <table className="w-full">
                  <thead className="hidden sm:table-header-group">
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-3 sm:px-6 py-3 font-medium">Student</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Borrowed</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Holding</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Overdue</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Fine</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="block sm:table-row-group sm:divide-y sm:divide-gray-100 dark:divide-gray-700">
                    {paginatedItems.map((member) => {
                      const s = memberStats[member.id] || {
                        total: 0,
                        holding: 0,
                        overdue: 0,
                        fine: 0,
                      };
                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/40 block sm:table-row border border-gray-200 dark:border-gray-700 rounded-lg mb-3 sm:border-0 sm:rounded-none sm:mb-0"
                        >
                          <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                              Student
                            </span>
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                                {member.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div className="ml-3 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {member.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                              Borrowed
                            </span>
                            {s.total}
                          </td>
                          <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4 text-sm text-gray-600 dark:text-gray-300">
                            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                              Holding
                            </span>
                            {s.holding}
                          </td>
                          <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4 text-sm">
                            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                              Overdue
                            </span>
                            {s.overdue > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                {s.overdue}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4 text-sm font-medium">
                            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                              Fine
                            </span>
                            {s.fine > 0 ? (
                              <span className="text-red-600 dark:text-red-400">
                                {formatCurrency(s.fine)}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          <td className="block sm:table-cell px-3 sm:px-6 py-2 sm:py-4">
                            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:hidden">
                              Actions
                            </span>
                            <button
                              onClick={() => setHistoryMember(member)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                            >
                              <HiOutlineClock className="h-4 w-4" />
                              History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Borrowers
            </h3>
          </div>
          {topBorrowers.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No borrowing activity yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {topBorrowers.map((member, index) => (
                <li
                  key={member.id}
                  className="px-4 sm:px-6 py-3 flex items-center gap-3"
                >
                  <span className="w-6 text-sm font-bold text-gray-400 dark:text-gray-500 text-center">
                    {index + 1}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                    {member.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {member.total} book{member.total === 1 ? "" : "s"} borrowed
                    </p>
                  </div>
                  {member.overdue > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 flex-shrink-0">
                      {member.overdue} late
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!historyMember}
        onClose={() => setHistoryMember(null)}
        title={`Borrow History — ${historyMember?.name || ""}`}
        size="lg"
      >
        {memberHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No borrowing history for this student yet.
          </p>
        ) : (
          <div className="space-y-3">
            {memberHistory.map((issue) => {
              const book = booksMap[issue.bookId];
              const effectiveStatus =
                issue.status === "issued" && isOverdue(issue.dueDate)
                  ? "overdue"
                  : issue.status;
              const fine =
                issue.status === "returned"
                  ? issue.fine || 0
                  : calculateFine(issue.dueDate);

              return (
                <div
                  key={issue.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {book?.title || "Unknown Book"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {book?.author || ""}
                      </p>
                    </div>
                    <StatusBadge status={effectiveStatus} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">
                        Issued
                      </p>
                      <p>{formatDate(issue.issueDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">
                        Due
                      </p>
                      <p>{formatDate(issue.dueDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">
                        Returned
                      </p>
                      <p>{issue.returnDate ? formatDate(issue.returnDate) : "-"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">
                        Fine
                      </p>
                      <p
                        className={
                          fine > 0
                            ? "font-semibold text-red-600 dark:text-red-400"
                            : ""
                        }
                      >
                        {fine > 0 ? formatCurrency(fine) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Students;
