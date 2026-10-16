// Serverless endpoint: securely provision a Student record + login account.
//
// Called from the existing "Add Students" workflow. It is the ONLY place that
// creates student accounts, because the Firebase Admin SDK must never be
// shipped to the browser.
//
// Behaviour:
//   - Auto-generates a unique Student ID (STU0001, STU0002, ...) using a
//     Firestore counter inside a transaction, so concurrent adds never collide.
//   - Creates the Firebase Auth account (email = student email, password =
//     registered mobile number) via the Admin SDK, so the signed-in staff
//     member's session is never switched.
//   - Creates/links the `members` record and the `users/{uid}` profile
//     (role: "student", plus the Student ID <-> UID <-> member mapping).
//   - Rolls the Auth account back if the Firestore write fails.
//   - Never returns, stores or logs the password.
//
// Security model:
//   1. Caller must send a Firebase ID token (Authorization: Bearer <token>).
//   2. Role is read from Firestore (users/{uid}) on the server — never trusted
//      from the request body.
//   3. Only an active admin or librarian may provision a student.
//   4. Role is always forced to "student"; the client cannot choose it.
//
// Required environment variables:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const REQUIRED_ENV = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

const STAFF_ROLES = ["admin", "librarian"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTER_DOC = "counters/studentId";

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

const asString = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeMobile = (value) => String(value || "").replace(/\D/g, "");
const formatStudentId = (n) => `STU${String(n).padStart(4, "0")}`;

// Ensure the counter exists, seeding it from any pre-existing STU#### ids so we
// never hand out a duplicate when the app is first used.
async function ensureCounter(db) {
  const counterRef = db.doc(COUNTER_DOC);
  const snap = await counterRef.get();
  if (snap.exists) return;

  const members = await db.collection("members").get();
  let max = 0;
  members.forEach((docSnap) => {
    const sid = docSnap.get("studentId") || "";
    const match = /^STU(\d+)$/.exec(sid);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });

  await counterRef.set({ value: max }, { merge: true });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let app;
  try {
    app = getAdminApp();
  } catch (error) {
    return res.status(500).json({
      error:
        "The student-creation service is not configured on the server. " +
        "Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    });
  }

  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // --- 1. Authenticate the caller -------------------------------------
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!idToken) {
      return res.status(401).json({ error: "You must be signed in." });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return res
        .status(401)
        .json({ error: "Your session is invalid or expired. Please sign in again." });
    }

    // --- 2. Authorize the caller (role read server-side) ----------------
    const callerSnap = await db.collection("users").doc(decoded.uid).get();
    if (!callerSnap.exists) {
      return res.status(403).json({ error: "Your staff profile was not found." });
    }
    const caller = callerSnap.data();
    if (
      !STAFF_ROLES.includes(caller.role) ||
      (caller.status && caller.status !== "active")
    ) {
      return res
        .status(403)
        .json({ error: "You are not allowed to create student accounts." });
    }

    // --- 3. Validate input ----------------------------------------------
    const body = req.body || {};
    const name = asString(body.name);
    const email = asString(body.email).toLowerCase();
    const mobile = normalizeMobile(body.phone);
    const className = asString(body.className);
    const address = asString(body.address);

    const fieldErrors = {};
    if (!name || name.length < 2) fieldErrors.name = "Full name is required.";
    if (!email) fieldErrors.email = "Email is required.";
    else if (!EMAIL_REGEX.test(email)) fieldErrors.email = "Enter a valid email address.";
    if (!mobile) fieldErrors.phone = "Mobile number is required.";
    else if (mobile.length < 10 || mobile.length > 13)
      fieldErrors.phone = "Enter a valid mobile number (10–13 digits).";

    if (Object.keys(fieldErrors).length > 0) {
      return res
        .status(400)
        .json({ error: "Please fix the highlighted fields.", fieldErrors });
    }

    // --- 4. Duplicate checks --------------------------------------------
    try {
      await auth.getUserByEmail(email);
      return res
        .status(409)
        .json({ error: "A user with this email address already exists." });
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    const emailProfileSnap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!emailProfileSnap.empty) {
      return res
        .status(409)
        .json({ error: "A profile with this email address already exists." });
    }

    // Reuse an existing (unlinked) member record when it matches this student.
    let existingMemberDoc = null;
    const memberEmailSnap = await db
      .collection("members")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!memberEmailSnap.empty) {
      const candidate = memberEmailSnap.docs[0];
      if (candidate.data().userId) {
        return res
          .status(409)
          .json({ error: "A student with this email address already has an account." });
      }
      existingMemberDoc = candidate;
    }

    // --- 5. Create the Firebase Auth account ----------------------------
    // The registered mobile number is the initial (temporary) password.
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password: mobile,
        displayName: name,
        emailVerified: false,
      });
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        return res
          .status(409)
          .json({ error: "A user with this email address already exists." });
      }
      if (error.code === "auth/invalid-password") {
        return res
          .status(400)
          .json({ fieldErrors: { phone: "Mobile number is too short to use as a password." } });
      }
      throw error;
    }

    // --- 6. Write records + auto Student ID (with rollback) --------------
    const memberRef = existingMemberDoc
      ? existingMemberDoc.ref
      : db.collection("members").doc();
    const userRef = db.collection("users").doc(userRecord.uid);
    const counterRef = db.doc(COUNTER_DOC);

    let studentId = "";
    try {
      await ensureCounter(db);

      const now = FieldValue.serverTimestamp();

      await db.runTransaction(async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const next = (counterSnap.exists ? counterSnap.data().value || 0 : 0) + 1;
        studentId = formatStudentId(next);

        transaction.set(counterRef, { value: next }, { merge: true });

        if (existingMemberDoc) {
          transaction.update(memberRef, {
            userId: userRecord.uid,
            studentId,
            name,
            mobile,
            phone: mobile,
            className,
            address,
            updatedAt: now,
          });
        } else {
          transaction.set(memberRef, {
            name,
            email,
            studentId,
            mobile,
            phone: mobile,
            className,
            address,
            userId: userRecord.uid,
            createdAt: now,
            updatedAt: now,
          });
        }

        transaction.set(userRef, {
          uid: userRecord.uid,
          name,
          email,
          role: "student",
          status: "active",
          studentId,
          memberId: memberRef.id,
          createdAt: now,
          updatedAt: now,
        });
      });
    } catch (error) {
      try {
        await auth.deleteUser(userRecord.uid);
      } catch (cleanupError) {
        console.error("Rollback of orphaned auth user failed:", cleanupError.code);
      }
      return res.status(500).json({
        error: "The account could not be saved and was rolled back. Please try again.",
      });
    }

    return res.status(201).json({
      uid: userRecord.uid,
      memberId: memberRef.id,
      studentId,
      name,
      email,
    });
  } catch (error) {
    console.error("create-student failed:", error.code || error.message);
    return res
      .status(500)
      .json({ error: "Something went wrong while creating the student account." });
  }
}
