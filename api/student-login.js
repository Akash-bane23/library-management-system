// Serverless endpoint: Student ID + password login.
//
// Firebase Authentication only supports email/password (or federated) sign-in,
// so we implement a secure username-style flow:
//
//   1. The client sends { studentId, password }.
//   2. The server resolves Student ID -> Firebase account using the trusted
//      users/{studentId mapping} profile (Admin SDK, server-side).
//   3. The server verifies the password against Firebase Authentication using
//      the Identity Toolkit REST API (the password is never stored or logged).
//   4. If valid and the account is an active student, the server mints a
//      Firebase custom token for the real UID.
//   5. The client exchanges the custom token with signInWithCustomToken(),
//      producing a normal, refreshable Firebase session.
//
// The Student ID supplied by the browser is NEVER trusted as proof of
// ownership — the password is always verified server-side.
//
// Required environment variables:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//   FIREBASE_API_KEY  (the Firebase Web API key — safe to use server-side)

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const REQUIRED_ENV = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_API_KEY",
];

// Best-effort in-memory rate limiting. Serverless instances are ephemeral, so
// this complements (but does not replace) Firebase Auth's built-in abuse
// protection.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function getAdminApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const error = new Error(
      `Server is not configured. Missing environment variables: ${missing.join(", ")}.`
    );
    error.code = "server/misconfigured";
    throw error;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const INVALID = {
  error: "Invalid Student ID or password. Please try again.",
  code: "invalid-credentials",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body || {};
  const studentId = String(body.studentId || "").trim().toUpperCase();
  const password = String(body.password || "");

  if (!studentId || !password) {
    return res
      .status(400)
      .json({ error: "Please enter your Student ID and password." });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (isRateLimited(`${ip}:${studentId}`)) {
    return res.status(429).json({
      error: "Too many attempts. Please wait a few minutes and try again.",
      code: "too-many-requests",
    });
  }

  let app;
  try {
    app = getAdminApp();
  } catch (error) {
    return res.status(500).json({
      error:
        "The login service is not configured on the server. Add the Firebase " +
        "admin and API-key environment variables.",
    });
  }

  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // --- 1. Resolve Student ID -> Firebase account (server-side) ---------
    const snap = await db
      .collection("users")
      .where("studentId", "==", studentId)
      .limit(1)
      .get();

    if (snap.empty) {
      // Same generic message so the endpoint does not reveal which IDs exist.
      return res.status(401).json(INVALID);
    }

    const profile = snap.docs[0].data();
    if (profile.role !== "student") {
      return res.status(401).json(INVALID);
    }

    // --- 2. Verify the password via Firebase Auth REST API ---------------
    let restResponse;
    try {
      restResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: profile.email,
            password,
            returnSecureToken: true,
          }),
        }
      );
    } catch {
      return res
        .status(503)
        .json({ error: "Network error. Please try again.", code: "network-error" });
    }

    if (!restResponse.ok) {
      const errBody = await restResponse.json().catch(() => null);
      const message = errBody?.error?.message || "";
      if (message.includes("TOO_MANY_ATTEMPTS")) {
        return res.status(429).json({
          error: "Too many failed attempts. Please try again later.",
          code: "too-many-requests",
        });
      }
      if (message.includes("USER_DISABLED")) {
        return res.status(403).json({
          error: "This account has been disabled. Please contact the library staff.",
          code: "account-disabled",
        });
      }
      return res.status(401).json(INVALID);
    }

    const data = await restResponse.json();
    const uid = data.localId;

    // --- 3. Final role/status checks before issuing a session ------------
    if (uid !== profile.uid) {
      return res.status(401).json(INVALID);
    }
    if (profile.status && profile.status !== "active") {
      return res.status(403).json({
        error: "This account has been disabled. Please contact the library staff.",
        code: "account-disabled",
      });
    }

    // --- 4. Mint a custom token for the verified student -----------------
    const customToken = await auth.createCustomToken(uid);

    return res.status(200).json({ customToken });
  } catch (error) {
    console.error("student-login failed:", error.code || error.message);
    return res
      .status(500)
      .json({ error: "Something went wrong while signing in. Please try again." });
  }
}
