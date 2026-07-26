#!/usr/bin/env node

/**
 * Admin Setup Script for Library Management System
 *
 * PREREQUISITES:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate new private key" and save as "service-account.json" in the scripts/ folder
 * 3. Run: node scripts/setup-admin.js
 *
 * This script will:
 * - Create an admin user in Firebase Authentication
 * - Store their profile in Firestore 'users' collection with role: "admin"
 */

import admin from "firebase-admin";
import readline from "readline";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("\n ERROR: service-account.json not found in scripts/ folder.");
  console.error("\n Steps to get it:");
  console.error("  1. Go to Firebase Console > Project Settings > Service Accounts");
  console.error('  2. Click "Generate new private key"');
  console.error("  3. Save the file as: scripts/service-account.json\n");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("\n========================================");
  console.log("  Library Management System - Admin Setup");
  console.log("========================================\n");

  const email = await ask("Admin email: ");
  const password = await ask("Admin password (min 6 chars): ");
  const name = await ask("Admin full name: ");

  if (!email || !password || !name) {
    console.error("\n All fields are required.");
    rl.close();
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("\n Password must be at least 6 characters.");
    rl.close();
    process.exit(1);
  }

  try {
    console.log("\nCreating Firebase Authentication user...");
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: true,
      });
      console.log(` User created with UID: ${userRecord.uid}`);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        console.log(" User already exists in Auth, fetching UID...");
        userRecord = await auth.getUserByEmail(email);
        console.log(` Found existing user UID: ${userRecord.uid}`);
      } else {
        throw err;
      }
    }

    console.log("Saving user profile to Firestore...");
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      email,
      role: "admin",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(" User profile saved with role: admin");

    console.log("\n========================================");
    console.log("  Admin account created successfully!");
    console.log(`  Email: ${email}`);
    console.log(`  Role:  admin`);
    console.log("========================================");
    console.log("\nYou can now log in to the application.\n");
  } catch (error) {
    console.error("\n Error:", error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
