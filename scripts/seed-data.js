#!/usr/bin/env node

/**
 * Seed Data Script for Library Management System
 *
 * Populates initial categories and authors into Firestore.
 *
 * PREREQUISITES:
 * 1. Run setup-admin.js first (needs service-account.json)
 * 2. Run: node scripts/seed-data.js
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("\n ERROR: service-account.json not found.");
  console.error(" Run setup-admin.js first to generate it.\n");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const CATEGORIES = [
  "Fiction",
  "Non-Fiction",
  "Science",
  "Technology",
  "History",
  "Biography",
  "Philosophy",
  "Mathematics",
  "Art & Design",
  "Children's Books",
  "Reference",
  "Textbook",
  "Romance",
  "Mystery",
  "Fantasy",
  "Self-Help",
  "Business",
  "Health & Fitness",
];

const AUTHORS = [
  "J.K. Rowling",
  "George Orwell",
  "Jane Austen",
  "Stephen King",
  "Agatha Christie",
  "Mark Twain",
  "Ernest Hemingway",
  "Leo Tolstoy",
  "Charles Dickens",
  "J.R.R. Tolkien",
  "Dan Brown",
  "Paulo Coelho",
  "Isaac Asimov",
  "Arthur C. Clarke",
  "Harper Lee",
  "Gabriel Garcia Marquez",
  "Toni Morrison",
  "Albert Camus",
];

async function seedCollection(collectionName, items) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.size > 0) {
    console.log(` ${collectionName}: Already has ${snapshot.size} documents. Skipping.`);
    return;
  }

  const batch = db.batch();
  items.forEach((item) => {
    const ref = db.collection(collectionName).doc();
    batch.set(ref, {
      name: item,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  console.log(` ${collectionName}: Added ${items.length} documents.`);
}

async function main() {
  console.log("\n========================================");
  console.log("  Library Management System - Seed Data");
  console.log("========================================\n");

  try {
    await seedCollection("categories", CATEGORIES);
    await seedCollection("authors", AUTHORS);

    console.log("\n Seed data added successfully!\n");
  } catch (error) {
    console.error("\n Error:", error.message);
  } finally {
    process.exit(0);
  }
}

main();
