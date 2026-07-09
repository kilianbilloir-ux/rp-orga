// js/auth-guard.js
// À importer sur toutes les pages protégées (dashboard, activités, membres,
// comptabilité, admin, notifications).
// Redirige vers login.html si personne n'est connecté, bloque les comptes bannis,
// branche les boutons "Déconnexion", et écoute en direct le profil Firestore
// (users/{uid}) : tout ce qui y est modifié depuis la console Firebase
// (rôle, organisation, heures de jeu...) se met à jour automatiquement ici.

import {
  auth, db, signOut, onAuthStateChanged, doc, onSnapshot,
} from "./firebase-init.js";

export const currentUser = {
  uid: null,
  username: null,
  role: 'Membre',
  organisation: '—',
  heuresDeJeu: 0,
  banned: false,
};

let profileUnsub = null;

function wireLogoutButtons() {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      if (profileUnsub) profileUnsub();
      await signOut(auth);
      window.location.href = 'login.html';
    });
  });
}

function fillPlaceholders() {
  document.querySelectorAll('[data-username]').forEach((el) => {
    el.textContent = currentUser.username || 'Membre';
  });
  document.querySelectorAll('[data-role]').forEach((el) => {
    el.textContent = currentUser.role || 'Membre';
  });
  document.querySelectorAll('[data-org]').forEach((el) => {
    el.textContent = currentUser.organisation || '—';
  });
  document.querySelectorAll('[data-hours]').forEach((el) => {
    el.textContent = `${currentUser.heuresDeJeu ?? 0}h`;
  });
}

function fatalAuthError(message) {
  console.error(message);
  alert(message);
  window.location.href = 'login.html';
}

export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      if (profileUnsub) profileUnsub();

      let firstLoad = true;
      profileUnsub = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (!snap.exists()) {
            fatalAuthError("Ton profil n'existe pas dans la base (users/" + user.uid + "). Reconnecte-toi ou recrée un compte.");
            return;
          }
          const data = snap.data();
          if (data.banned) {
            alert('Ce compte a été banni.');
            signOut(auth).finally(() => { window.location.href = 'login.html'; });
            return;
          }

          currentUser.uid = user.uid;
          currentUser.username = data.username;
          currentUser.role = data.role || 'Membre';
          currentUser.organisation = data.organisation || '—';
          currentUser.heuresDeJeu = data.heuresDeJeu ?? 0;

          wireLogoutButtons();
          fillPlaceholders();

          if (firstLoad) {
            firstLoad = false;
            resolve(currentUser);
          }
        },
        (err) => {
          // Cause la plus fréquente : règles Firestore mal collées/publiées,
          // ou champ manquant dans les règles → "Missing or insufficient permissions".
          fatalAuthError("Impossible de charger ton profil Firestore : " + err.message);
        },
      );
    });
  });
}
