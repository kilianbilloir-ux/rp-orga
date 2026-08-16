// js/auth-guard.js
// À importer sur toutes les pages protégées (dashboard, activités, membres,
// comptabilité, admin, notifications...).
// Redirige vers login.html si personne n'est connecté, bloque les comptes bannis,
// branche les boutons "Déconnexion", écoute en direct le profil Firestore
// (users/{uid}), et vérifie à chaque ouverture de page si un délai (ATM,
// Cambu, Supérette, Go fast) vient de se terminer pour envoyer le message
// Discord — comme ça, ouvrir n'importe quel onglet du site suffit à
// déclencher l'envoi, pas besoin d'aller spécifiquement sur Notifications.

import {
  auth, db, signOut, onAuthStateChanged, doc, onSnapshot,
  collection, query, where, getDocs, updateDoc,
} from "./firebase-init.js";
import { initCountdownWidget } from "./countdowns.js";

export const currentUser = {
  uid: null,
  username: null,
  role: 'Membre',
  organisation: '—',
  heuresDeJeu: 0,
  discordId: '',
  banned: false,
};

let profileUnsub = null;
let cooldownCheckDone = false;

// Délai (en heures) avant de pouvoir refaire la même action.
const COOLDOWN_HOURS = {
  "Go fast": 24,
  "ATM": 3,
  "Supérette": 3,
  "Cambu": 3,
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1530506907570274304/eKV0vr_Xox5mJNscu-fgdNUdFh8CMfzJQm-2HdnMTHBgj-2wCrRr6JZx6FoxuSMJmkgt";

async function sendDiscordMessage(content) {
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.error('Erreur webhook Discord :', e);
  }
}

// Vérifie une seule fois par ouverture de page si un délai vient de se
// terminer pour la personne connectée, et envoie le message Discord.
async function checkCooldownsOnce() {
  if (cooldownCheckDone || !currentUser.uid) return;
  cooldownCheckDone = true;

  try {
    const snap = await getDocs(query(collection(db, 'actions'), where('uid', '==', currentUser.uid)));
    const now = Date.now();

    for (const docSnap of snap.docs) {
      const a = docSnap.data();
      const cooldown = COOLDOWN_HOURS[a.item];
      if (!cooldown || a.discordNotified) continue;

      const doneAt = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const availableAt = doneAt + cooldown * 3600 * 1000;
      if (now < availableAt) continue;

      await updateDoc(doc(db, 'actions', docSnap.id), { discordNotified: true });
      const who = currentUser.discordId ? `<@${currentUser.discordId}>` : `**${currentUser.username}**`;
      await sendDiscordMessage(`✅ ${who} peut maintenant refaire un(e) **${a.item}** !`);
    }
  } catch (e) {
    console.error('Erreur vérification des délais :', e);
  }
}

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
          currentUser.discordId = data.discordId || '';

          wireLogoutButtons();
          fillPlaceholders();
          checkCooldownsOnce();
          initCountdownWidget(currentUser);

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
