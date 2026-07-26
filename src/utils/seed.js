import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";

const SEED_DATA = {
  categories: [
    { name: "Programming" },
    { name: "Database" },
  ],
  authors: [
    { name: "Robert C. Martin" },
    { name: "Ramez Elmasri" },
  ],
  books: [
    {
      isbn: "9780132350884",
      title: "Clean Code",
      author: "Robert C. Martin",
      category: "Programming",
      publisher: "Prentice Hall",
      quantity: 5,
      shelfNumber: "A-01",
      status: "available",
    },
    {
      isbn: "9780078022159",
      title: "Database System Concepts",
      author: "Ramez Elmasri",
      category: "Database",
      publisher: "McGraw-Hill",
      quantity: 4,
      shelfNumber: "B-02",
      status: "available",
    },
    {
      isbn: "9780134685991",
      title: "Fundamentals of Database Systems",
      author: "Ramez Elmasri",
      category: "Database",
      publisher: "Pearson",
      quantity: 3,
      shelfNumber: "B-03",
      status: "available",
    },
  ],
  members: [
    {
      name: "Rahul Patil",
      email: "rahul.patil@email.com",
      phone: "9876543210",
      address: "123 Main Street, Pune, Maharashtra, India",
    },
    {
      name: "Sneha Joshi",
      email: "sneha.joshi@email.com",
      phone: "9123456789",
      address: "456 Park Avenue, Mumbai, Maharashtra, India",
    },
  ],
};

export async function seedDemoData() {
  console.log("🌱 Starting seed...");

  const categoriesSnapshot = await getDocs(collection(db, "categories"));
  if (!categoriesSnapshot.empty) {
    const msg = "Data already exists. Skipping seed.";
    console.log("⚠️ " + msg);
    return { success: false, message: msg };
  }

  console.log("📂 Adding categories...");
  for (const cat of SEED_DATA.categories) {
    await addDoc(collection(db, "categories"), {
      name: cat.name,
      createdAt: serverTimestamp(),
    });
    console.log("  + " + cat.name);
  }

  console.log("✍️  Adding authors...");
  for (const author of SEED_DATA.authors) {
    await addDoc(collection(db, "authors"), {
      name: author.name,
      createdAt: serverTimestamp(),
    });
    console.log("  + " + author.name);
  }

  console.log("📚 Adding books...");
  for (const book of SEED_DATA.books) {
    await addDoc(collection(db, "books"), {
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      category: book.category,
      publisher: book.publisher,
      quantity: book.quantity,
      availableQuantity: book.quantity,
      shelfNumber: book.shelfNumber,
      status: book.status,
      createdAt: serverTimestamp(),
    });
    console.log("  + " + book.title);
  }

  console.log("👥 Adding members...");
  for (const member of SEED_DATA.members) {
    await addDoc(collection(db, "members"), {
      name: member.name,
      email: member.email,
      phone: member.phone,
      address: member.address,
      createdAt: serverTimestamp(),
    });
    console.log("  + " + member.name);
  }

  const msg = "Seed complete! Refresh the page to see data.";
  console.log("✅ " + msg);
  return { success: true, message: msg };
}
