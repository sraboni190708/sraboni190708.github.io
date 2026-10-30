// Shared Google sign-in + progress sync for pages on this site.
// A page opts in by importing this module (the brain-install engine does it
// when its SYNC_MODULE is set to "/shared/sync.js"). Pages that don't import
// it never load Firebase and never ask anyone to sign in.
//
// Data lives at users/{uid}/decks/{key} in Firestore. The project's security
// rules only let a signed-in user read or write their own users/{uid} path.
// The config below is a public identifier, not a secret.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDoWShXgbR89LfoR207Aso28VLacGUwirg",
  authDomain: "estelles-desk-46442.firebaseapp.com",
  projectId: "estelles-desk-46442",
  storageBucket: "estelles-desk-46442.firebasestorage.app",
  messagingSenderId: "487446465682",
  appId: "1:487446465682:web:e8dddff6b5f3c5ed8a2a4b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Finish a redirect sign-in if the popup fallback was used.
getRedirectResult(auth).catch(() => {});

/** Calls cb with {uid, name, email} when signed in, or null when signed out. */
export function onUser(cb) {
  return onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, name: u.displayName || "", email: u.email || "" } : null));
}

/** Opens Google sign-in. Falls back to a full-page redirect where popups are blocked. */
export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const fallback = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"];
    if (fallback.includes(e && e.code)) return signInWithRedirect(auth, provider);
    if (e && (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request")) return;
    throw e;
  }
}

export function signOutUser() { return signOut(auth); }

/** A plain-English message for a sign-in or sync error. */
export function explain(e) {
  const c = (e && e.code) || "";
  if (c === "auth/unauthorized-domain") return "This site isn't on the Firebase authorized domains list yet.";
  if (c === "auth/network-request-failed" || c === "unavailable") return "No connection. Progress is still saved on this device.";
  if (c === "permission-denied") return "Firebase refused access. Check the Firestore security rules.";
  return (e && e.message) || "Something went wrong.";
}

/** Read/write/watch one deck's progress document for the signed-in user. */
export function deck(key) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  const ref = doc(db, "users", u.uid, "decks", key);
  return {
    async get() { const s = await getDoc(ref); return s.exists() ? s.data() : null; },
    set(data) { return setDoc(ref, data); },
    watch(cb, err) {
      return onSnapshot(ref, s => { if (s.exists() && !s.metadata.hasPendingWrites) cb(s.data()); }, err);
    }
  };
}
