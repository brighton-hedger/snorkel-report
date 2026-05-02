const SITE_URL = "https://snorkelreports.com";
const SITE_NAME = "Oahu Snorkel Report";
const SITE_DESCRIPTION =
  "Daily Oahu snorkeling conditions with live shore reports, forecasts, maps, and region-by-region planning tools.";
const LOGO_URL = `${SITE_URL}/assets/snorkeling_turtle_favicon.svg`;

const BREADCRUMB_LABELS = {
  about: "About",
  "ala-moana": "Ala Moana",
  blog: "Blog",
  "day-forecast": "Day Forecast",
  "detailed-reports": "Detailed Reports",
  "dono-conditions-check": "Dono Conditions Check",
  feedback: "Feedback",
  haleiwa: "Haleiwa",
  "hawaii-kai": "Hawaii Kai",
  "kaneohe-bay": "Kaneohe Bay",
  "ko-olina": "Ko Olina",
  "lanikai-kailua": "Lanikai/Kailua",
  "live-report": "Live Report",
  map: "Map",
  nanakuli: "Nanakuli",
  "pokai-bay": "Pokai Bay",
  pupukea: "Pupukea",
  search: "Search",
  waikiki: "Waikiki",
  waimanalo: "Waimanalo",
  "waimea-bay": "Waimea Bay",
  "week-forecast": "Week Forecast",
  "read-the-score": "How to Read the Oahu Snorkel Score",
  "tide-matters": "Why Tide Matters for Snorkeling",
  "wind-swell-visibility": "Wind, Swell, and Visibility Are Not the Same"
};

const REGION_SLUGS = new Set([
  "ala-moana",
  "haleiwa",
  "hawaii-kai",
  "kaneohe-bay",
  "ko-olina",
  "lanikai-kailua",
  "nanakuli",
  "pokai-bay",
  "pupukea",
  "waikiki",
  "waimanalo",
  "waimea-bay"
]);

const BLOG_POSTS = new Set([
  "/blog/read-the-score",
  "/blog/tide-matters",
  "/blog/wind-swell-visibility"
]);

function getCanonicalUrl() {
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  return canonicalEl?.href || `${SITE_URL}${window.location.pathname}`;
}

function getPageTitle() {
  const h1 = document.querySelector("h1")?.textContent?.trim();
  return h1 || document.title || SITE_NAME;
}

function getDescription() {
  return (
    document.querySelector('meta[name="description"]')?.content?.trim() ||
    SITE_DESCRIPTION
  );
}

function buildBreadcrumbList(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const crumbs = [{ name: "Home", item: SITE_URL }];

  if (normalizedPath === "/") {
    return {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.item
      }))
    };
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  let currentPath = "";
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    crumbs.push({
      name: BREADCRUMB_LABELS[segment] || segment.replace(/-/g, " "),
      item: `${SITE_URL}${currentPath}`
    });
  });

  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item
    }))
  };
}

function buildWebsiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "en-US"
  };
}

function buildOrganizationSchema() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL
    }
  };
}

function buildWebPageSchema(url, title, description) {
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: {
      "@id": `${SITE_URL}/#website`
    },
    about: {
      "@type": "Thing",
      name: "Oahu snorkeling conditions"
    },
    inLanguage: "en-US"
  };
}

function buildCollectionPageSchema(url, title, description) {
  return {
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: title,
    description,
    isPartOf: {
      "@id": `${SITE_URL}/#website`
    },
    inLanguage: "en-US"
  };
}

function buildAboutPageSchema(url, title, description) {
  return {
    "@type": "AboutPage",
    "@id": `${url}#about-page`,
    url,
    name: title,
    description,
    isPartOf: {
      "@id": `${SITE_URL}/#website`
    },
    about: {
      "@type": "Person",
      name: "Brighton Hedger"
    },
    inLanguage: "en-US"
  };
}

function buildBlogPostingSchema(url, title, description) {
  return {
    "@type": "BlogPosting",
    "@id": `${url}#blog-post`,
    headline: title,
    description,
    mainEntityOfPage: url,
    author: {
      "@type": "Person",
      name: "Brighton Hedger"
    },
    publisher: {
      "@id": `${SITE_URL}/#organization`
    },
    isPartOf: {
      "@id": `${SITE_URL}/#website`
    },
    image: LOGO_URL,
    inLanguage: "en-US"
  };
}

function buildRegionPageSchema(url, title, description, slug) {
  const regionName = BREADCRUMB_LABELS[slug] || title;
  return {
    "@type": "WebPage",
    "@id": `${url}#region-report`,
    url,
    name: title,
    description,
    isPartOf: {
      "@id": `${SITE_URL}/#website`
    },
    about: {
      "@type": "Thing",
      name: `${regionName} snorkeling conditions`
    },
    keywords: [
      `${regionName} snorkel report`,
      `${regionName} snorkeling conditions`,
      "Oahu snorkel report"
    ],
    inLanguage: "en-US"
  };
}

function buildSchemaGraph() {
  const url = getCanonicalUrl();
  const title = getPageTitle();
  const description = getDescription();
  const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
  const slug = pathname.split("/").filter(Boolean).slice(-1)[0] || "";
  const graph = [buildBreadcrumbList(pathname)];

  if (pathname === "/") {
    graph.unshift(buildOrganizationSchema());
    graph.unshift(buildWebsiteSchema());
    graph.push(buildWebPageSchema(url, title, description));
    return graph;
  }

  if (pathname === "/about") {
    graph.unshift(buildOrganizationSchema());
    graph.unshift(buildWebsiteSchema());
    graph.push(buildAboutPageSchema(url, title, description));
    return graph;
  }

  if (pathname === "/blog" || pathname === "/detailed-reports") {
    graph.unshift(buildWebsiteSchema());
    graph.push(buildCollectionPageSchema(url, title, description));
    return graph;
  }

  if (BLOG_POSTS.has(pathname)) {
    graph.unshift(buildOrganizationSchema());
    graph.unshift(buildWebsiteSchema());
    graph.push(buildBlogPostingSchema(url, title, description));
    return graph;
  }

  if (REGION_SLUGS.has(slug)) {
    graph.unshift(buildWebsiteSchema());
    graph.push(buildRegionPageSchema(url, title, description, slug));
    return graph;
  }

  graph.unshift(buildWebsiteSchema());
  graph.push(buildWebPageSchema(url, title, description));
  return graph;
}

function injectStructuredData() {
  if (document.getElementById("seo-structured-data")) {
    return;
  }

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "seo-structured-data";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": buildSchemaGraph()
  });
  document.head.appendChild(script);
}

injectStructuredData();
