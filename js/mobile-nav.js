// js/mobile-nav.js
// Ouvre/ferme la sidebar en mode panneau sur mobile.

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('menuToggle');
  const closeBtn = document.getElementById('sidebarClose');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !toggle) return;

  function openMenu() {
    sidebar.classList.add('open');
    backdrop?.classList.add('open');
  }
  function closeMenu() {
    sidebar.classList.remove('open');
    backdrop?.classList.remove('open');
  }

  toggle.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  backdrop?.addEventListener('click', closeMenu);

  // Ferme le menu automatiquement quand on tape un lien.
  sidebar.querySelectorAll('a.side-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
});
