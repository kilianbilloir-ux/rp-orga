// js/auth-guard.js
// À importer sur toutes les pages protégées (dashboard, activités, statistiques,
// membres, comptabilité, admin, notifications).
// Redirige vers login.html si personne n'est connecté, bloque les comptes bannis,
// et branche les boutons "Déconnexion".

import {
  auth, db, signOut, onAuthStateChanged, doc, getDoc,
} from "./firebase-init.js";

export const currentUser = { uid: null, username: null, role: "membre", organisation: "—", banned: false };

function wireLogoutButtons() {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = 'login.html';
    });
  });
}

function fillUsernamePlaceholders() {
  document.querySelectorAll('[data-username]').forEach((el) => {
    el.textContent = currentUser.username || 'Membre';
  });
  document.querySelectorAll('[data-role]').forEach((el) => {
    el.textContent = currentUser.role || 'Membre';
  });
  document.querySelectorAll('[data-org]').forEach((el) => {
    el.textContent = currentUser.organisation || '—';
  });
}

export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        // Profil manquant (ne devrait pas arriver) : on déconnecte par sécurité.
        await signOut(auth);
        window.location.href = 'login.html';
        return;
      }
      const data = snap.data();
      if (data.banned) {
        alert("Ce compte a été banni.");
        await signOut(auth);
        window.location.href = 'login.html';
        return;
      }
      currentUser.uid = user.uid;
      currentUser.username = data.username;
      currentUser.role = data.role || 'Membre';
      currentUser.organisation = data.organisation || '—';

      wireLogoutButtons();
      fillUsernamePlaceholders();
      resolve(currentUser);
    });
  });
}
