import { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

const FIRST_ADMIN_EMAIL = "baneakash7@gmail.com";
const FIRST_ADMIN_NAME = "Akash";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const getUserProfile = async (uid) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error("Error reading user profile:", error.code, error.message);
      return null;
    }
  };

  const createFirstAdminProfile = async (uid, email) => {
    const profileData = {
      uid,
      name: FIRST_ADMIN_NAME,
      email,
      role: "admin",
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid), profileData);
    return { id: uid, ...profileData };
  };

  const login = async (email, password) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === "auth/invalid-credential") {
        const isFirstAdmin =
          email.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase();
        if (isFirstAdmin) {
          try {
            return await createUserWithEmailAndPassword(
              auth,
              email,
              password
            );
          } catch (createError) {
            if (createError.code === "auth/email-already-in-use") {
              const err = new Error(
                "The password you entered is incorrect."
              );
              err.code = "auth/wrong-password";
              throw err;
            }
            throw createError;
          }
        }
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  // Student login uses the Student ID (not an email). A trusted serverless
  // endpoint resolves the ID, verifies the password and returns a custom token,
  // which we exchange for a normal Firebase session.
  const loginWithStudentId = async (studentId, password) => {
    let response;
    try {
      response = await fetch("/api/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password }),
      });
    } catch {
      const error = new Error(
        "Could not reach the login service. Check your connection and try again."
      );
      error.code = "student/network-error";
      throw error;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.customToken) {
      const error = new Error(
        payload?.error ||
          (response.status === 404
            ? "The login service was not found. If you are running locally, start the app with `vercel dev`."
            : "Login failed. Please try again.")
      );
      error.code = payload?.code || "student/login-failed";
      throw error;
    }

    return signInWithCustomToken(auth, payload.customToken);
  };

  const register = async (email, password, name, role = "librarian") => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      role,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return result;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);

          if (profile) {
            if (profile.status === "disabled") {
              await signOut(auth);
              return;
            }
            setUserProfile(profile);
          } else {
            const isAdminEmail =
              user.email?.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase();

            if (isAdminEmail) {
              try {
                const newProfile = await createFirstAdminProfile(
                  user.uid,
                  user.email
                );
                setUserProfile(newProfile);
              } catch (error) {
                console.error(
                  "Failed to create admin profile in Firestore:",
                  error.code,
                  error.message
                );
                setUserProfile({
                  uid: user.uid,
                  name: FIRST_ADMIN_NAME,
                  email: user.email,
                  role: "admin",
                  status: "active",
                });
              }
            } else {
              await signOut(auth);
              return;
            }
          }
        } catch (error) {
          console.error("Auth state error:", error.code, error.message);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isAdmin = userProfile?.role === "admin";
  const isLibrarian = userProfile?.role === "librarian";

  const value = {
    currentUser,
    userProfile,
    login,
    loginWithStudentId,
    logout,
    register,
    isAdmin,
    isLibrarian,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
