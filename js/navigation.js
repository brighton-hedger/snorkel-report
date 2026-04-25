// ==================== NAVIGATION SCRIPT ====================

const DETAILED_REPORT_SLUGS = new Set([
  'lanikai-kailua',
  'waimanalo',
  'kaneohe-bay',
  'waikiki',
  'ala-moana',
  'hawaii-kai',
  'haleiwa',
  'waimea-bay',
  'pupukea',
  'ko-olina',
  'pokai-bay',
  'nanakuli'
]);

const NAV_LINKS = [
  { href: 'live-report.html', label: 'Live Report', route: 'live-report' },
  { href: 'day-forecast.html', label: 'Day Forecast', route: 'day-forecast' },
  { href: 'week-forecast.html', label: 'Week Forecast', route: 'week-forecast' },
  { href: 'map.html', label: 'Map', route: 'map' },
  { href: 'detailed-reports.html', label: 'Detailed Reports', route: 'detailed-reports' },
  { href: 'search.html', label: 'Search', route: 'search' }
];

const MORE_LINKS = [
  { href: 'feedback.html', label: 'Feedback', route: 'feedback' },
  { href: 'about.html', label: 'About', route: 'about' },
  { href: 'blog.html', label: 'Blog', route: 'blog' }
];

function initializeNavigation() {
  hydrateNavigation();
  const currentPage = normalizeRoute(window.location.pathname);
  const navLinks = document.querySelectorAll('nav a');

  navLinks.forEach(link => {
    const href = normalizeRoute(link.getAttribute('href') || '');
    if (shouldMarkActive(href, currentPage)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  const moreMenu = document.querySelector('.nav-more-menu');
  if (moreMenu) {
    const moreIsActive = MORE_LINKS.some((item) => shouldMarkActive(item.route, currentPage));
    moreMenu.classList.toggle('active', moreIsActive);
  }

  initializeMoreMenuDismiss();
  initializeMobileMenu();
  initializeDaylightWarning();
}

function hydrateNavigation() {
  const nav = document.querySelector('nav');
  if (!nav) {
    return;
  }

  nav.innerHTML = '';

  const logoLink = document.createElement('a');
  logoLink.href = 'index.html';
  logoLink.className = 'nav-home-logo';
  logoLink.setAttribute('aria-label', 'Go to home page');
  logoLink.innerHTML = '<img src="assets/snorkeling_turtle_favicon.svg" alt="">';
  nav.appendChild(logoLink);

  // Desktop navigation (hidden on mobile)
  const navCenter = document.createElement('div');
  navCenter.className = 'nav-center-links';

  NAV_LINKS.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    link.dataset.route = item.route;
    navCenter.appendChild(link);
  });

  const moreMenu = document.createElement('details');
  moreMenu.className = 'nav-more-menu';

  const moreSummary = document.createElement('summary');
  moreSummary.textContent = 'More';
  moreMenu.appendChild(moreSummary);

  const morePanel = document.createElement('div');
  morePanel.className = 'nav-more-panel';

  MORE_LINKS.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    link.dataset.route = item.route;
    morePanel.appendChild(link);
  });

  moreMenu.appendChild(morePanel);
  navCenter.appendChild(moreMenu);
  nav.appendChild(navCenter);

  const spacer = document.createElement('div');
  spacer.className = 'nav-spacer';
  nav.appendChild(spacer);

  // Mobile hamburger button
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Open navigation menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(hamburger);

  // Create mobile panel
  let mobilePanel = document.querySelector('.nav-mobile-panel');
  if (!mobilePanel) {
    mobilePanel = document.createElement('div');
    mobilePanel.className = 'nav-mobile-panel';
    document.body.appendChild(mobilePanel);
  }

  // Add all links to mobile panel
  mobilePanel.innerHTML = '';
  NAV_LINKS.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    link.dataset.route = item.route;
    mobilePanel.appendChild(link);
  });

  const divider = document.createElement('div');
  divider.className = 'nav-mobile-divider';
  mobilePanel.appendChild(divider);

  MORE_LINKS.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    link.dataset.route = item.route;
    mobilePanel.appendChild(link);
  });

  // Create overlay
  let overlay = document.querySelector('.nav-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);
  }
}

function normalizeRoute(value) {
  const raw = String(value || '').trim();
  const noOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
  const noQuery = noOrigin.split('?')[0].split('#')[0];
  const trimmed = noQuery.replace(/^\/+|\/+$/g, '');
  const normalized = trimmed.replace(/\.html$/i, '');
  return normalized === 'index' ? '' : normalized;
}

function shouldMarkActive(navRoute, currentRoute) {
  const route = navRoute || '';

  if (route === currentRoute) {
    return true;
  }

  if (route === '' && currentRoute === '') {
    return true;
  }

  if (route === 'blog' && currentRoute.startsWith('blog/')) {
    return true;
  }

  if (route === 'blog' && currentRoute.startsWith('blog-')) {
    return true;
  }

  if (route === 'detailed-reports' && DETAILED_REPORT_SLUGS.has(currentRoute)) {
    return true;
  }

  return false;
}

function initializeMoreMenuDismiss() {
  const moreMenu = document.querySelector('.nav-more-menu');
  if (!moreMenu || moreMenu.dataset.dismissReady === 'true') {
    return;
  }

  moreMenu.dataset.dismissReady = 'true';

  document.addEventListener('pointerdown', (event) => {
    if (!moreMenu.hasAttribute('open')) {
      return;
    }

    if (moreMenu.contains(event.target)) {
      return;
    }

    moreMenu.removeAttribute('open');
  });

  const panelLinks = moreMenu.querySelectorAll('.nav-more-panel a');
  panelLinks.forEach((link) => {
    link.addEventListener('click', () => {
      moreMenu.removeAttribute('open');
    });
  });
}

function initializeMobileMenu() {
  const hamburger = document.querySelector('.nav-hamburger');
  const mobilePanel = document.querySelector('.nav-mobile-panel');
  const overlay = document.querySelector('.nav-overlay');

  if (!hamburger || !mobilePanel || !overlay) {
    return;
  }

  // Toggle menu on hamburger click
  hamburger.addEventListener('click', () => {
    const isOpen = mobilePanel.classList.contains('open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', closeMobileMenu);

  // Close on link click
  const panelLinks = mobilePanel.querySelectorAll('a');
  panelLinks.forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
    }
  });

  function openMobileMenu() {
    mobilePanel.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    mobilePanel.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
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
