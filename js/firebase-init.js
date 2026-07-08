// js/firebase-init.js
// Initialise Firebase et exporte les instances Auth / Firestore
// utilisées par toutes les pages du site.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2aKj2p-u3CyvfVkIgqRpAhzQBeP8mGpA",
  authDomain: "rp-orga.firebaseapp.com",
  projectId: "rp-orga",
  storageBucket: "rp-orga.firebasestorage.app",
  messagingSenderId: "1046389938514",
  appId: "1:1046389938514:web:1fcb97a58c8b2a5bca428b",
  measurementId: "G-PYGT7PJMK8",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase Auth veut un email : on en fabrique un à partir du pseudo,
// pour que les gens se connectent avec juste "pseudo + PIN".
export function usernameToEmail(username) {
  return username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "") + "@rp-orga.local";
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
};
