import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTIONS = {
  USERS: "users",
  BOOKS: "books",
  MEMBERS: "members",
  CATEGORIES: "categories",
  AUTHORS: "authors",
  ISSUED_BOOKS: "issuedBooks",
};

// Generic CRUD operations
const createDocument = async (collectionName, data) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

const getDocuments = async (collectionName, conditions = [], orderByField = null, limitCount = null, lastDoc = null) => {
  let q = collection(db, collectionName);
  const constraints = [];

  conditions.forEach(({ field, operator, value }) => {
    constraints.push(where(field, operator, value));
  });

  if (orderByField) {
    constraints.push(orderBy(orderByField, "desc"));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  if (limitCount) {
    constraints.push(limit(limitCount));
  }

  if (constraints.length > 0) {
    q = query(q, ...constraints);
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return { docs, lastVisible, hasMore: snapshot.docs.length === limitCount };
};

const getDocument = async (collectionName, docId) => {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

const updateDocument = async (collectionName, docId, data) => {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

const deleteDocument = async (collectionName, docId) => {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
};

// Book operations
const booksService = {
  create: (data) => createDocument(COLLECTIONS.BOOKS, { ...data, availableQuantity: data.quantity }),
  getAll: (conditions, orderByField, limitCount, lastDoc) =>
    getDocuments(COLLECTIONS.BOOKS, conditions, orderByField, limitCount, lastDoc),
  getById: (id) => getDocument(COLLECTIONS.BOOKS, id),
  update: (id, data) => updateDocument(COLLECTIONS.BOOKS, id, data),
  delete: (id) => deleteDocument(COLLECTIONS.BOOKS, id),
  search: async (searchTerm) => {
    const allBooks = await getDocuments(COLLECTIONS.BOOKS);
    return allBooks.docs.filter(
      (book) =>
        book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.isbn?.includes(searchTerm)
    );
  },
};

// Member operations
const membersService = {
  create: (data) => createDocument(COLLECTIONS.MEMBERS, data),
  getAll: (conditions, orderByField, limitCount, lastDoc) =>
    getDocuments(COLLECTIONS.MEMBERS, conditions, orderByField, limitCount, lastDoc),
  getById: (id) => getDocument(COLLECTIONS.MEMBERS, id),
  update: (id, data) => updateDocument(COLLECTIONS.MEMBERS, id, data),
  delete: (id) => deleteDocument(COLLECTIONS.MEMBERS, id),
};

// Category operations
const categoriesService = {
  create: (data) => createDocument(COLLECTIONS.CATEGORIES, data),
  getAll: () => getDocuments(COLLECTIONS.CATEGORIES),
  getById: (id) => getDocument(COLLECTIONS.CATEGORIES, id),
  update: (id, data) => updateDocument(COLLECTIONS.CATEGORIES, id, data),
  delete: (id) => deleteDocument(COLLECTIONS.CATEGORIES, id),
};

// Author operations
const authorsService = {
  create: (data) => createDocument(COLLECTIONS.AUTHORS, data),
  getAll: () => getDocuments(COLLECTIONS.AUTHORS),
  getById: (id) => getDocument(COLLECTIONS.AUTHORS, id),
  update: (id, data) => updateDocument(COLLECTIONS.AUTHORS, id, data),
  delete: (id) => deleteDocument(COLLECTIONS.AUTHORS, id),
};

// Issued Books operations
const issuedBooksService = {
  create: async (data) => {
    const id = await createDocument(COLLECTIONS.ISSUED_BOOKS, { ...data, status: "issued" });
    const book = await getDocument(COLLECTIONS.BOOKS, data.bookId);
    if (book) {
      await updateDocument(COLLECTIONS.BOOKS, data.bookId, {
        availableQuantity: Math.max(0, (book.availableQuantity || 0) - 1),
      });
    }
    return id;
  },
  getAll: (conditions, orderByField, limitCount, lastDoc) =>
    getDocuments(COLLECTIONS.ISSUED_BOOKS, conditions, orderByField, limitCount, lastDoc),
  getById: (id) => getDocument(COLLECTIONS.ISSUED_BOOKS, id),
  returnBook: async (issueId, fine = 0) => {
    const issue = await getDocument(COLLECTIONS.ISSUED_BOOKS, issueId);
    if (issue) {
      await updateDocument(COLLECTIONS.ISSUED_BOOKS, issueId, {
        returnDate: new Date().toISOString(),
        fine,
        status: "returned",
      });
      const book = await getDocument(COLLECTIONS.BOOKS, issue.bookId);
      if (book) {
        await updateDocument(COLLECTIONS.BOOKS, issue.bookId, {
          availableQuantity: (book.availableQuantity || 0) + 1,
        });
      }
    }
  },
  getOverdue: async () => {
    const allIssued = await getDocuments(COLLECTIONS.ISSUED_BOOKS);
    const today = new Date().toISOString().split("T")[0];
    return allIssued.docs.filter(
      (issue) => issue.status === "issued" && issue.dueDate < today
    );
  },
};

export {
  COLLECTIONS,
  createDocument,
  getDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  booksService,
  membersService,
  categoriesService,
  authorsService,
  issuedBooksService,
};
