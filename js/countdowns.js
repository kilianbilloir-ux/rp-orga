// js/countdowns.js
// Widget "Délais en cours" : injecté automatiquement en haut de chaque page
// protégée (sauf notifications.html, qui a déjà les notifications "prêt").
// Affiche un compte à rebours en direct pour chaque action en cooldown
// (ATM, Cambu, Supérette, Go fast) faite par la personne connectée.

import { db, collection, query, where, onSnapshot } from "./firebase-init.js";

const COOLDOWN_HOURS = {
  "Go fast": 24,
  "ATM": 3,
  "Supérette": 3,
  "Cambu": 3,
  "Conteneurs": 2,
};

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let started = false;

export function initCountdownWidget(currentUser) {
  // Pas sur la page Notifications (qui gère déjà "tu peux recommencer").
  if (window.location.pathname.endsWith('notifications.html')) return;
  // Évite de le lancer plusieurs fois (ex: rechargements du profil).
  if (started) return;
  started = true;

  const page = document.querySelector('main.page');
  if (!page) return;

  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'countdownCard';
  card.style.display = 'none';
  card.style.marginBottom = '20px';
  card.style.maxWidth = '480px';
  card.innerHTML = `
    <h3>Délais en cours</h3>
    <p class="card-sub">Temps restant avant de pouvoir refaire chaque action.</p>
    <div id="countdownList"></div>
  `;

  const header = page.querySelector('.page-header');
  if (header) {
    header.insertAdjacentElement('afterend', card);
  } else {
    page.insertBefore(card, page.firstChild);
  }

  let pendingCooldowns = [];

  function renderCountdowns() {
    const list = document.getElementById('countdownList');
    if (pendingCooldowns.length === 0) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    list.innerHTML = pendingCooldowns.map(a => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 4px; border-bottom:1px solid var(--border);">
        <span style="color:var(--text-0); font-weight:600;">${a.item}</span>
        <span style="font-family:var(--font-display); font-weight:700; color:var(--green);" data-countdown="${a.item}" data-until="${a.availableAt}">--:--:--</span>
      </div>
    `).join('');
  }

  onSnapshot(query(collection(db, 'actions'), where('uid', '==', currentUser.uid)), (snap) => {
    const now = Date.now();
    const latestPerItem = snap.docs
      .map(d => d.data())
      .filter(a => COOLDOWN_HOURS[a.item])
      .map(a => {
        const doneAt = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const cooldown = COOLDOWN_HOURS[a.item];
        return { item: a.item, doneAt, availableAt: doneAt + cooldown * 3600 * 1000 };
      })
      .reduce((acc, a) => {
        if (!acc[a.item] || a.doneAt > acc[a.item].doneAt) acc[a.item] = a;
        return acc;
      }, {});

    pendingCooldowns = Object.values(latestPerItem).filter(a => now < a.availableAt);
    renderCountdowns();
  });

  setInterval(() => {
    const now = Date.now();
    let anyJustFinished = false;
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const until = Number(el.dataset.until);
      const remaining = until - now;
      if (remaining <= 0) {
        anyJustFinished = true;
      } else {
        el.textContent = formatDuration(remaining);
      }
    });
    if (anyJustFinished) {
      pendingCooldowns = pendingCooldowns.filter(a => a.availableAt > now);
      renderCountdowns();
    }
  }, 1000);
}
