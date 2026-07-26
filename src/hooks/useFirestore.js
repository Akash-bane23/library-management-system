import { useState, useEffect, useCallback } from "react";

export const useFirestore = (service, conditions = [], autoFetch = true) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.getAll(conditions);
      setData(result.docs);
      setLastDoc(result.lastVisible);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [service, JSON.stringify(conditions)]);

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  return { data, loading, error, fetch, lastDoc, hasMore };
};

export const usePagination = (items, itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  return {
    paginatedItems,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    setCurrentPage,
  };
};

export const useSearch = (items, searchFields = []) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState(items);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredItems(items);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = items.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        if (typeof value === "string") {
          return value.toLowerCase().includes(term);
        }
        if (typeof value === "number") {
          return value.toString().includes(term);
        }
        return false;
      })
    );
    setFilteredItems(filtered);
  }, [searchTerm, items, searchFields]);

  return { searchTerm, setSearchTerm, filteredItems };
};
