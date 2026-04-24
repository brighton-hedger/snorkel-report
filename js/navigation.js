// ==================== NAVIGATION SCRIPT ====================

function initializeNavigation() {
  // Set active link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('nav a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  initializeDaylightWarning();
}

function initializeDaylightWarning() {
  const existingBanner = document.getElementById('daylight-warning');
  if (existingBanner) {
    existingBanner.remove();
  }

  const now = new Date();
  const hour = now.getHours();
  const daylightStartHour = window.SnorkelShared?.DAYLIGHT_START_HOUR ?? 6;
  const daylightEndHour = window.SnorkelShared?.DAYLIGHT_END_HOUR ?? 18;
  const isNight = hour < daylightStartHour || hour >= daylightEndHour;

  if (!isNight) return;

  const nav = document.querySelector('nav');
  if (!nav || !nav.parentNode) return;

  const banner = document.createElement('div');
  banner.id = 'daylight-warning';
  banner.className = 'daylight-warning';
  banner.innerHTML = `
    <strong>Low-light notice:</strong>
    These snorkel scores are calibrated for daylight conditions. Between dusk and dawn, visibility and in-water safety can be meaningfully worse than the score suggests.
  `;

  nav.insertAdjacentElement('afterend', banner);
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
  initializeNavigation();
}
