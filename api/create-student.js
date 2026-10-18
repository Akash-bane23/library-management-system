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
// Required configuration: see server/firebase-admin.js. The project id is
// reused from the frontend config (VITE_FIREBASE_PROJECT_ID) when the
// server-side FIREBASE_PROJECT_ID is not set.

import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "../server/firebase-admin.js";

const STAFF_ROLES = ["admin", "librarian"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTER_DOC = "counters/studentId";

const asString = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeMobile = (value) => String(value || "").replace(/\D/g, "");
const formatStudentId = (n) => `STU${String(n).padStart(4, "0")}`;

// Server-side diagnostics. Never logs request bodies (they contain the
// initial password) — only error codes, messages and generated ids.
const requestId = () => Math.random().toString(36).slice(2, 10);
const logError = (id, stage, error) =>
  console.error(`[create-student ${id}] ${stage}:`, {
    code: error?.code || "unknown",
    message: error?.message || String(error),
  });

export default async function handler(req, res) {
  const id = requestId();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let auth;
  let db;
  try {
    ({ auth, db } = getAdminServices());
  } catch (error) {
    logError(id, "init", error);
    return res.status(500).json({
      error:
        error?.code === "server/misconfigured" || error?.code === "server/invalid-key"
          ? `${error.message} Add them to .env locally and to Vercel (Project Settings -> Environment Variables). Run \`npm run check:firebase\` for details.`
          : "The student-creation service is not configured on the server. Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (see .env.example).",
    });
  }

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
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== "object") body = {};
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
    const now = FieldValue.serverTimestamp();
    try {
      await db.runTransaction(async (transaction) => {
        // Firestore requires every read to happen before every write.
        const counterSnap = await transaction.get(counterRef);
        let next;
        if (counterSnap.exists) {
          next = (counterSnap.data().value || 0) + 1;
        } else {
          // First ever creation: seed from existing STU#### ids inside this
          // same transaction. Seeding in a separate write could race with a
          // concurrent add and hand out a duplicate id.
          let max = 0;
          const allMembers = await transaction.get(db.collection("members"));
          allMembers.forEach((docSnap) => {
            const match = /^STU(\d+)$/.exec(docSnap.get("studentId") || "");
            if (match) max = Math.max(max, parseInt(match[1], 10));
          });
          next = max + 1;
        }

        // Defensive duplicate guard: never reuse an id another record holds.
        const idQuery = () =>
          db.collection("members").where("studentId", "==", formatStudentId(next)).limit(1);
        let clash = await transaction.get(idQuery());
        while (
          !clash.empty &&
          clash.docs.some((docSnap) => docSnap.id !== memberRef.id) &&
          next < 999999
        ) {
          next += 1;
          clash = await transaction.get(idQuery());
        }

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
      logError(id, "record write failed; rolling back auth user", error);
      try {
        await auth.deleteUser(userRecord.uid);
        console.log(
          `[create-student ${id}] rollback ok (uid=${userRecord.uid}, studentId=${studentId || "none"})`
        );
      } catch (cleanupError) {
        // The auth account still exists but has no profile: report the uid so
        // it can be removed from the Firebase console (no secrets involved).
        console.error(`[create-student ${id}] ROLLBACK FAILED - manual cleanup required:`, {
          uid: userRecord.uid,
          code: cleanupError?.code,
          message: cleanupError?.message,
        });
      }
      return res.status(500).json({
        error: "The account could not be saved and was rolled back. Please try again.",
      });
    }

    console.log(
      `[create-student ${id}] ok (studentId=${studentId}, memberId=${memberRef.id})`
    );
    return res.status(201).json({
      uid: userRecord.uid,
      memberId: memberRef.id,
      studentId,
      name,
      email,
    });
  } catch (error) {
    logError(id, "unhandled failure", error);
    return res
      .status(500)
      .json({ error: "Something went wrong while creating the student account." });
  }
}
