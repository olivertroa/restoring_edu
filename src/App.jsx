import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import usaStatesMap from "@svg-maps/usa.states-territories";
import {
  ArrowRight,
  BookOpenText,
  Buildings,
  CaretDown,
  CaretRight,
  Check,
  FileText,
  List,
  MagnifyingGlass,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import content from "./data/site-content.json";
import newsArticles from "./data/news-articles";

const pageByRoute = new Map(content.pages.map((page) => [page.route, page]));
const pageById = new Map(content.pages.map((page) => [page.id, page]));
const navItems = [
  ["Home", "/"],
  ["News", "/news/"],
  ["Education Freedom State Scores", "/grading-system/"],
  ["District Watch", "/district-watch/"],
];
const headerNavItems = navItems.filter(([, href]) => href !== "/grading-system/");

const districtWatchStates = [
  { name: "Arizona", code: "AZ", hubRoute: "/district-watch/arizona-schools/", sourceRoute: "/district-watch/arizona-schools/", gradeRoute: "/arizona/", image: "/media/uploads/2026/11/arizona/arizona-state-outline.svg" },
  { name: "Georgia", code: "GA", hubRoute: "/district-watch/georgia-schools/", sourceRoute: "/georgia/", image: "/media/uploads/2026/08/georgia-scaled.png" },
  { name: "Michigan", code: "MI", hubRoute: "/district-watch/michigan-schools/", sourceRoute: "/michigan/", image: "/media/uploads/2026/10/Michigan-state-map-scaled.png" },
  { name: "North Carolina", code: "NC", hubRoute: "/district-watch/north-carolina-schools/", sourceRoute: "/district-watch/north-carolina-schools/", image: "/media/uploads/2026/01/state-map_North-Carolina-scaled.png" },
  { name: "Virginia", code: "VA", hubRoute: "/district-watch/virginia-schools/", sourceRoute: "/district-watch/virginia-schools/", image: "/media/uploads/2026/02/state-map_virginia2-scaled.png" },
  { name: "Wisconsin", code: "WI", hubRoute: "/district-watch/wisconsin-schools/", sourceRoute: "/district-watch/wisconsin-schools/", image: "/media/uploads/2026/01/state-map_Wisconsin-scaled.png" },
];

const newsStories = [
  {
    title: "New Documentary Exposes How Teachers' Unions Harm Inner City Children",
    image: "/media/uploads/2025/09/BBall-Court.jpg",
    href: "https://restoration-news.com/new-documentary-exposes-how-teachers-unions-harm-inner-city-children-watch",
  },
  {
    title: "Virginia Teachers' Unions Focus on Politics, Not Teachers",
    image: "/media/uploads/2025/05/Restoring-Edu-VA.png",
    href: "https://restoration-news.com/virginia-teachers-unions-focus-on-politics-not-teachers",
  },
  {
    title: "Why Are So Many Small Town Virginia School Districts Under Investigation?",
    image: "/media/uploads/2025/05/Restoring-Edu-Classroom.png",
    href: "https://restoration-news.com/small-town-virginia-school-districts-under-investigation",
  },
];

function normalizeRoute(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function internalHref(href) {
  if (!href) return false;
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href);
    return ["www.restoringedu.com", "restoringedu.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function localHref(href) {
  if (!href) return "#";
  if (href.startsWith("/")) return href;
  try {
    const url = new URL(href);
    return internalHref(href) ? url.pathname : href;
  } catch {
    return href;
  }
}

function clampWords(value, limit = 20) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  return words.length > limit ? `${words.slice(0, limit).join(" ")}.` : words.join(" ");
}

function preventOrphan(value) {
  const text = String(value || "").trim();
  const lastSpace = text.lastIndexOf(" ");
  return lastSpace > 0 ? `${text.slice(0, lastSpace)}\u00a0${text.slice(lastSpace + 1)}` : text;
}

function headingText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingText).join("");
  return headingText(node?.props?.children);
}

function headingId(children) {
  return headingText(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function stateConfigForRoute(route) {
  return districtWatchStates.find((state) => route.startsWith(state.sourceRoute) || route === state.hubRoute || route === state.gradeRoute);
}

function districtChildren(page) {
  const state = districtWatchStates.find((entry) => entry.hubRoute === page.route);
  const root = state ? pageByRoute.get(state.sourceRoute) : page;
  return (root?.childIds || []).map((id) => pageById.get(id)).filter((child) => child?.kind === "directory");
}

function nameKey(value) {
  return String(value || "").toLowerCase().replace(/\bpolic(?:y|ies)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function directoryPeople(page) {
  return page.childIds.map((id) => pageById.get(id)).filter((child) => child?.kind === "profile");
}

function directoryPeopleGroups(page, people) {
  const bodyLines = String(page.body || "").split("\n");
  const groupsByName = new Map();
  let currentGroup = "board";

  bodyLines.forEach((line) => {
    const heading = line.match(/^#\s+(.+)/)?.[1]?.toLowerCase();
    if (heading) {
      if (/employee|staff|superintendent|administrat|librarian/.test(heading)) currentGroup = "employees";
      if (/board/.test(heading)) currentGroup = "board";
      return;
    }

    const personHeading = line.match(/^#{3,6}\s+(.+)/)?.[1];
    if (!personHeading) return;
    const headingKey = nameKey(personHeading);
    const person = people.find((candidate) => {
      const candidateKey = nameKey(candidate.title);
      return headingKey.includes(candidateKey) || candidateKey.includes(headingKey);
    });
    if (person) groupsByName.set(person.id, currentGroup);
  });

  const board = [];
  const employees = [];
  people.forEach((person) => {
    (groupsByName.get(person.id) === "employees" ? employees : board).push(person);
  });
  return { board, employees };
}

function directoryPolicies(page) {
  const key = nameKey(page.title);
  return content.pages.filter((candidate) => candidate.kind === "policy" && nameKey(candidate.title) === key);
}

function logicalDirectory(page) {
  if (page.kind === "directory" && !districtWatchStates.some((state) => state.hubRoute === page.route)) return page;
  if (page.kind === "policy") return content.pages.find((candidate) => candidate.kind === "directory" && nameKey(candidate.title) === nameKey(page.title));
  const parent = pageById.get(page.parentId);
  return parent?.kind === "directory" ? parent : null;
}

function DistrictBreadcrumb({ page, current = true }) {
  const district = logicalDirectory(page);
  const state = stateConfigForRoute(district?.route || page.route);
  if (!state) return null;
  const isHub = page.route === state.hubRoute;
  return (
    <nav className="district-breadcrumb" aria-label="Breadcrumb">
      <Link to="/district-watch/">District Watch</Link><CaretRight size={14} />
      {isHub ? <span aria-current="page">{state.name}</span> : <Link to={state.hubRoute}>{state.name}</Link>}
      {!isHub && district && <><CaretRight size={14} />{page.id === district.id ? <span aria-current="page">{district.title}</span> : <Link to={district.route}>{district.title}</Link>}</>}
      {!isHub && district && current && page.id !== district.id && <><CaretRight size={14} /><span aria-current="page">{page.title}</span></>}
    </nav>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <>
      <header className="site-header">
        <div className="shell nav-shell">
          <Link className="wordmark" to="/" aria-label="Restoration of Education home">
            <img src="/media/brand/restoring-edu-logo-navy.png?v=20261111" alt="" />
          </Link>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {headerNavItems.map(([label, href]) => (
              <NavLink key={href} to={href} className={({ isActive }) => (isActive ? "active" : "")}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search site">
              <MagnifyingGlass size={20} weight="bold" />
            </button>
            <Link className="nav-cta" to="/district-watch/">Explore districts</Link>
            <button className="icon-button menu-button" onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X size={23} /> : <List size={23} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {headerNavItems.map(([label, href]) => <Link key={href} to={href}>{label}</Link>)}
          </nav>
        )}
      </header>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const value = query.toLowerCase();
    return content.pages.filter((page) => `${page.title} ${page.description}`.toLowerCase().includes(value)).slice(0, 8);
  }, [query]);

  return (
    <div className="search-backdrop" role="dialog" aria-modal="true" aria-label="Search Restoring Education">
      <div className="search-dialog">
        <div className="search-title">
          <h2>Search the research</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close search"><X size={24} /></button>
        </div>
        <label htmlFor="site-search">Search states, districts, people, and policies</label>
        <div className="search-field">
          <MagnifyingGlass size={22} />
          <input id="site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Virginia or East Lansing" />
        </div>
        <div className="search-results" aria-live="polite">
          {query.length > 1 && results.length === 0 && <p>No pages match that search.</p>}
          {results.map((page) => (
            <Link key={page.id} to={page.route} onClick={onClose}>
              <span>{page.title}</span><small>{page.kind.replaceAll("-", " ")}</small>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link className="wordmark footer-mark" to="/" aria-label="Restoring Education home">
            <img src="/media/brand/restoring-edu-logo-white.png?v=20261111" alt="" />
          </Link>
          <p>{preventOrphan("Research that helps parents understand education choices, state policy, and local school leadership.")}</p>
        </div>
        <div className="footer-links">
          <strong>Explore</strong>
          {navItems.slice(1).map(([label, href]) => <Link key={href} to={href}>{label}</Link>)}
        </div>
        <div className="footer-contact">
          <strong>Accuracy matters</strong>
          <p>{preventOrphan("For media inquiries and corrections:")}</p>
          <a href="mailto:tips@restorationpac.com">tips@restorationpac.com</a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>Research brought to you by Restoration News</span>
        <span>Copyright © 2026 Restoration of America. All rights reserved.</span>
      </div>
    </footer>
  );
}

const mapStateNameAliases = {
  "Washington, DC": "District of Columbia",
};

const gradeLabels = {
  A: "Strongest education freedom",
  B: "Broad education options",
  C: "Mixed education options",
  D: "Limited education options",
  F: "Few education options",
};

const gradedStates = content.pages
  .filter((page) => page.kind === "state" && page.grade)
  .sort((a, b) => a.title.localeCompare(b.title));

function StateGradesMap({ states }) {
  const navigate = useNavigate();
  const [activeState, setActiveState] = useState(null);
  const statesByName = useMemo(() => new Map(states.map((state) => [state.title, state])), [states]);
  const mapLocations = useMemo(() => usaStatesMap.locations.map((location) => {
    const contentName = mapStateNameAliases[location.name] || location.name;
    return { ...location, state: statesByName.get(contentName) };
  }).filter((location) => location.state), [statesByName]);

  function followState(event, route) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(route);
  }

  return (
    <div className="grade-map-layout">
      <div className="grade-map-panel">
        <svg className="grade-map" viewBox={usaStatesMap.viewBox} role="group" aria-label="Interactive map of state education grades">
          {mapLocations.map((location) => {
            const state = location.state;
            const grade = state.grade?.charAt(0).toUpperCase();
            return (
              <a
                key={location.id}
                href={state.route}
                aria-label={`${state.title}, grade ${state.grade}`}
                onClick={(event) => followState(event, state.route)}
                onMouseEnter={() => setActiveState(state)}
                onMouseLeave={() => setActiveState(null)}
                onFocus={() => setActiveState(state)}
                onBlur={() => setActiveState(null)}
              >
                <path className={`grade-map-state grade-map-grade-${grade?.toLowerCase()}`} d={location.path}>
                  <title>{state.title}: Grade {state.grade}</title>
                </path>
              </a>
            );
          })}
        </svg>
      </div>
      <aside className="grade-map-guide" aria-live="polite">
        <div className="grade-map-current">
          <span>{activeState ? "Selected state" : "Explore the map"}</span>
          <strong>{activeState?.title || "Choose a state"}</strong>
          <p>{preventOrphan(activeState ? `Grade ${activeState.grade}. Click to view the full state report.` : "Hover, focus, or tap a state to see its grade and open its report.")}</p>
        </div>
        <div className="grade-map-legend" aria-label="State grade color key">
          {Object.entries(gradeLabels).map(([grade, label]) => (
            <div key={grade}>
              <strong className={`grade grade-${grade.toLowerCase()}`}>{grade}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function HomePage() {
  const states = gradedStates;

  return (
    <>
      <section className="hero shell">
        <div className="hero-copy reveal">
          <h1>Restore.<br />Education.</h1>
          <p>{preventOrphan("See how your state protects education freedom and what choices are available to your family.")}</p>
          <div className="state-jump">
            <label htmlFor="hero-state">Find your state</label>
            <select id="hero-state" defaultValue="" onChange={(event) => { if (event.target.value) window.location.href = event.target.value; }}>
              <option value="" disabled>Select a state</option>
              {states.map((state) => <option key={state.id} value={state.route}>{state.title} - {state.grade}</option>)}
            </select>
            <CaretDown size={20} weight="bold" />
          </div>
        </div>
        <div className="hero-panels reveal-late" aria-label="Education research highlights">
          <Link className="hero-panel hero-panel-main" to="/grading-system/">
            <img src="/media/generated/design-1-education-hero.png" alt="Parents and students reviewing education materials together" />
            <span>Education Freedom<br />State Scores</span>
            <p className="hero-panel-excerpt">{preventOrphan("See how each state measures up on school choice, student funding, and homeschooling freedom.")}</p>
            <em>{preventOrphan("Learn more")} <ArrowRight size={16} weight="bold" /></em>
          </Link>
          <Link className="hero-panel hero-panel-side" to="/district-watch/">
            <img src="/media/uploads/2025/05/Restoring-Edu-Classroom.png" alt="An apple and books in a classroom" />
            <span>District<br />Watch</span>
            <p className="hero-panel-excerpt">{preventOrphan("Explore research on the school board members and leaders shaping policies in local classrooms.")}</p>
            <em>{preventOrphan("Learn more")} <ArrowRight size={16} weight="bold" /></em>
          </Link>
          <Link className="hero-panel hero-panel-side" to="/news/">
            <img src="/media/uploads/2025/09/BBall-Court.jpg" alt="An urban basketball court" />
            <span>Latest<br />News</span>
            <p className="hero-panel-excerpt">{preventOrphan("Read the latest reporting and analysis about education freedom across America.")}</p>
            <em>{preventOrphan("Learn more")} <ArrowRight size={16} weight="bold" /></em>
          </Link>
        </div>
      </section>

      <section className="state-finder section-space" id="state-grades">
        <div className="shell">
          <div className="section-heading compact-heading">
            <h2>What grade did your state receive?</h2>
            <p>{preventOrphan("Select any state to compare education freedom, family options, and state policy across the country.")}</p>
            <Link className="primary-button" to="/grading-system/">
              {preventOrphan("View the grading system")} <ArrowRight size={18} />
            </Link>
          </div>
          <StateGradesMap states={states} />
        </div>
      </section>

      <section className="measure-section section-space shell">
        <div className="measure-intro">
          <h2>Choice should follow the family.</h2>
          <p>{preventOrphan("The grading system focuses on concrete freedoms available to parents, students, and educators.")}</p>
          <Link className="text-link" to="/grading-system/">{preventOrphan("How grading works")} <ArrowRight size={18} /></Link>
        </div>
        <div className="measure-grid">
          <article className="measure-large">
            <BookOpenText size={38} weight="duotone" />
            <h3>Education options</h3>
            <p>{preventOrphan("Choice programs, charter schools, scholarships, and alternative learning models.")}</p>
          </article>
          <article><strong>Funding</strong><p>{preventOrphan("Whether state education dollars can follow the student.")}</p></article>
          <article><strong>Homeschooling</strong><p>{preventOrphan("Whether families can teach without unnecessary government interference.")}</p></article>
        </div>
      </section>

      <section className="watch-feature section-space shell">
        <div className="watch-image">
          <img src="/media/generated/design-1-classroom-teacher.jpg" alt="A teacher leading a classroom lesson while students work at their desks" />
        </div>
        <div className="watch-copy">
          <span className="eyebrow">District Watch</span>
          <h2>Know who shapes your local schools.</h2>
          <p>{preventOrphan("Explore districts, board members, school leaders, policies, and the supporting source material.")}</p>
          <div className="watch-states">
            {districtWatchStates.map(({ name }) => <span key={name}><Check size={16} weight="bold" />{name}</span>)}
          </div>
          <Link className="primary-button" to="/district-watch/">{preventOrphan("Explore districts")} <ArrowRight size={18} /></Link>
        </div>
      </section>

      <section className="news-section section-space shell">
        <div className="section-heading compact-heading">
          <h2>The latest in education</h2>
          <Link className="text-link" to="/news/">{preventOrphan("View all news")} <ArrowRight size={18} /></Link>
        </div>
        <div className="news-layout">
          {newsStories.map((story, index) => (
            <a key={story.href} href={story.href} target="_blank" rel="noreferrer" className={index === 0 ? "story story-featured" : "story"}>
              <img src={story.image} alt="" />
              <div><h3>{preventOrphan(story.title)}</h3><span>{preventOrphan("Read at Restoration News")} <ArrowRight size={16} /></span></div>
            </a>
          ))}
        </div>
      </section>

      <section className="closing-cta shell section-space">
        <div><Buildings size={46} weight="duotone" /><h2>Start with your community.</h2></div>
        <p>{preventOrphan("Find your state grade, then explore the districts and decision-makers closest to home.")}</p>
        <Link className="primary-button" to="/district-watch/">{preventOrphan("Explore districts")} <ArrowRight size={18} /></Link>
      </section>
    </>
  );
}

function MarkdownBody({ page, stripFirstHeading = true, stripFirstImage = false }) {
  let body = page.body;
  if (stripFirstHeading) body = body.replace(/^#\s+[^\n]+\n+/, "");
  if (stripFirstImage && page.images?.[0]?.src) {
    let removedHeroImage = false;
    body = body.replace(/!\[[^\]]*\]\(([^)]+)\)\s*/g, (match, src) => {
      if (!removedHeroImage && src === page.images[0].src) {
        removedHeroImage = true;
        return "";
      }
      return match;
    });
  }
  if (page.kind === "state") body = body.replace(/^#\s+CURRENT GRADE:\s*[A-F][+-]?\s*/i, "");
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
          a: ({ href, children }) => internalHref(href)
            ? <Link to={localHref(href)}>{children}</Link>
            : <a href={href} target="_blank" rel="noreferrer">{children}</a>,
          img: ({ src, alt }) => <img src={src} alt={alt || ""} loading="lazy" />,
        }}
      >{body}</ReactMarkdown>
    </div>
  );
}

function StatePage({ page }) {
  const description = clampWords(page.description || page.body.replace(/[#*_\[\]\(\)]/g, " ").replace(/\s+/g, " "), 20);
  const districtState = districtWatchStates.find((state) => (state.gradeRoute || state.sourceRoute) === page.route && state.hubRoute !== page.route);
  return (
    <>
      <section className="page-hero state-hero shell">
        <div>
          <Link className="back-link" to="/#state-grades">All state grades</Link>
          <h1>{page.title}</h1>
          <p>{preventOrphan(description)}</p>
        </div>
        <div className={`grade-orb grade-${page.grade?.charAt(0).toLowerCase()}`}><small>Current grade</small><strong>{page.grade}</strong></div>
      </section>
      {districtState && (
        <Link className="state-watch-link shell" to={districtState.hubRoute}>
          <span><UsersThree size={27} weight="duotone" /><strong>District Watch in {page.title}</strong></span>
          <span>View districts, board members, employees, and policies <ArrowRight size={18} /></span>
        </Link>
      )}
      <main className="content-shell shell content-with-aside">
        <article><MarkdownBody page={page} /></article>
        <aside className="sticky-aside">
          <strong>On this page</strong>
          <a href="#education-options">Education options</a>
          <a href="#homeschooling-laws">Homeschooling laws</a>
          <span>NAEP performance</span>
          <Link to="/grading-system/">Grading methodology</Link>
        </aside>
      </main>
    </>
  );
}

function DirectoryPage({ page }) {
  const state = districtWatchStates.find((entry) => entry.hubRoute === page.route);
  const districts = state ? districtChildren(page) : [];
  const people = state ? [] : directoryPeople(page);
  const peopleGroups = state ? { board: [], employees: [] } : directoryPeopleGroups(page, people);
  const policies = state ? [] : directoryPolicies(page);
  const image = state?.image || page.images[0]?.src || "/media/uploads/2026/01/district-watch-heading-scaled.png";
  const totalPeople = districts.reduce((sum, district) => sum + directoryPeople(district).length, 0);
  return (
    <>
      <section className="directory-hero shell">
        <div><DistrictBreadcrumb page={page} /><span className="eyebrow">District Watch</span>{state ? <h1 className={`state-directory-title state-title-${state.code.toLowerCase()}`}><span>{state.name}</span><span>Schools</span></h1> : <h1>{page.title}</h1>}<p>{preventOrphan(clampWords(page.description || (state ? "Select a district to explore its leadership, employees, policies, and supporting sources." : "Review local school leadership, employees, policies, and supporting sources."), 20))}</p></div>
        {state
          ? <div className="state-vector-art"><img src={image} alt={`${state.name} state outline`} /></div>
          : <img className="district-logo" src={image} alt={`${page.title} identity`} />}
      </section>
      {state && (
        <>
          <section className="directory-summary shell" aria-label={`${state.name} District Watch summary`}>
            <div><Buildings size={26} weight="duotone" /><strong>{districts.length}</strong><span>Districts</span></div>
            <div><UsersThree size={26} weight="duotone" /><strong>{totalPeople}</strong><span>People profiled</span></div>
            <Link to="/district-watch/got-a-tip/">{preventOrphan("Report a tip")} <ArrowRight size={17} /></Link>
          </section>
          <section className="district-list shell section-space">
            <div className="directory-section-heading"><h2>Select a district.</h2><p>{preventOrphan("Each district brings its leadership profiles, employee research, policy records, and original source links together.")}</p></div>
            <div className="directory-grid">
              {districts.map((district) => {
                const districtPeople = directoryPeople(district);
                const districtPolicies = directoryPolicies(district);
                return (
                  <Link key={district.id} to={district.route} className="directory-card">
                    {district.images[0] ? <img src={district.images[0].src} alt="" /> : <div className="directory-placeholder"><Buildings size={42} /></div>}
                    <div><h3>{district.title}</h3><p>{preventOrphan(`${districtPeople.length} people${districtPolicies.length ? `, ${districtPolicies.length} policy page${districtPolicies.length === 1 ? "" : "s"}` : ""}`)}</p><span>{preventOrphan("Open district")} <ArrowRight size={17} /></span></div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
      {!state && (
        <>
          <section className="district-overview shell">
            <div><UsersThree size={30} weight="duotone" /><strong>{people.length}</strong><span>Board members and employees</span></div>
          </section>
          {policies.length > 0 && <section className="research-links shell"><h2>District policies</h2>{policies.map((policy) => <Link key={policy.id} to={policy.route}><FileText size={24} /><span><strong>{policy.title}</strong><small>{preventOrphan("Review policy research and supporting sources")}</small></span><ArrowRight size={19} /></Link>)}</section>}
          {people.length > 0 && (
            <section className="people-section shell section-space">
              <div className="directory-section-heading"><h2>District leadership.</h2><p>{preventOrphan("Board members and district employees are organized separately, matching the structure of the original site.")}</p></div>
              {[
                ["Board members", peopleGroups.board],
                ["Employees", peopleGroups.employees],
              ].filter(([, group]) => group.length > 0).map(([title, group]) => (
                <section className="people-group" key={title} aria-labelledby={`${headingId(title)}-${page.id}`}>
                  <div className="people-group-heading">
                    <h3 id={`${headingId(title)}-${page.id}`}>{title}</h3>
                    <span>{group.length} {group.length === 1 ? "profile" : "profiles"}</span>
                  </div>
                  <div className="people-grid">
                    {group.map((person) => (
                      <Link key={person.id} to={person.route} className="person-card">
                        {person.images[0] ? <img src={person.images[0].src} alt={person.images[0].alt || person.title} /> : <div className="person-placeholder"><UsersThree size={35} /></div>}
                        <div>
                          {person.profileStatus && <strong className="person-status">{person.profileStatus}</strong>}
                          <h3>{person.title}</h3>
                          {person.description && <p>{preventOrphan(clampWords(person.description, 16))}</p>}
                          <span>{preventOrphan("View research")} <ArrowRight size={16} /></span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

function DistrictWatchPage({ page }) {
  const hubs = districtWatchStates.map((state) => {
    const page = pageByRoute.get(state.hubRoute);
    const districts = districtChildren(page);
    const people = districts.reduce((sum, district) => sum + directoryPeople(district).length, 0);
    return { ...page, ...state, districts, people };
  }).filter((hub) => hub.id);
  return (
    <>
      <section className="watch-landing-hero shell">
        <div>
          <span className="eyebrow">District Watch</span>
          <h1>Local records.<br />Clear choices.</h1>
          <div className="watch-hero-intro">
            <p>{preventOrphan("This is District Watch, our project to expose the worst school board members and school leaders focused on indoctrinating children rather than educating them. We’re naming names because we believe in restoring America’s schools—not surrendering them.")}</p>
            <div className="watch-hero-help">
              <h2>But we need your help.</h2>
              <p>Whether it’s dropping a <Link to="/district-watch/got-a-tip/">tip</Link> or <a href="https://restorationaction.revv.co/donate-now" target="_blank" rel="noreferrer">funding our work,</a> we can’t win the war alone. District Watch is a project of <a href="https://restoration-news.com/" target="_blank" rel="noreferrer">Restoration News</a>, your source for exclusive, headline-smashing news and&nbsp;opinion.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="hub-section shell section-space" aria-labelledby="state-directory-heading">
        <h2 id="state-directory-heading">Click on your state to see the WORST school board members and superintendents.</h2>
        <div className="hub-grid">
          {hubs.map((hub) => (
            <Link key={hub.id} to={hub.route} className="hub-card">
              <div className="hub-state-badge" aria-hidden="true"><small>State</small><strong>{hub.code}</strong></div>
              <div className="hub-card-copy"><h2>{hub.name}</h2><span>{preventOrphan(`${hub.districts.length} districts, ${hub.people} people`)} <ArrowRight size={17} /></span></div>
            </Link>
          ))}
        </div>
      </section>
      <section className="tip-band shell"><div><h2>Have a tip?</h2><p>{preventOrphan("Share information about local school leadership or district policy.")}</p></div><Link className="primary-button" to="/district-watch/got-a-tip/">{preventOrphan("Report a tip")} <ArrowRight size={18} /></Link></section>
    </>
  );
}

function TipPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <section className="tip-page-hero shell">
        <div>
          <DistrictBreadcrumb page={pageByRoute.get("/district-watch/got-a-tip/")} />
          <span className="eyebrow">District Watch</span>
          <h1>Got a Tip?</h1>
        </div>
        <div className="tip-page-intro">
          <p>{preventOrphan("Please report woke school board members and school leaders here.")}</p>
          <p>{preventOrphan("Providing an email address will allow us to correspond with you if we have questions.")}</p>
        </div>
      </section>

      <section className="tip-form-section shell" aria-labelledby="tip-form-title">
        <div className="tip-form-heading">
          <span>Send us a tip</span>
          <h2 id="tip-form-title">Share what you know.</h2>
          <p>{preventOrphan("Use the form to provide names, district details, policy information, or links to supporting material.")}</p>
        </div>
        <form className="tip-form" onSubmit={handleSubmit}>
          <div className="tip-form-row">
            <label>
              <span>Name</span>
              <input type="text" name="name" autoComplete="name" />
            </label>
            <label>
              <span>Email Address</span>
              <input type="email" name="email" autoComplete="email" aria-describedby="tip-email-note" />
              <small id="tip-email-note">{preventOrphan("Optional, but helpful if we need to follow up.")}</small>
            </label>
          </div>
          <label>
            <span>Message</span>
            <textarea name="message" rows="8" required />
          </label>
          <div className="tip-form-actions">
            <button className="primary-button" type="submit">{preventOrphan("Submit tip")} <ArrowRight size={18} /></button>
            <p>{preventOrphan("Submission delivery will be enabled when this form is connected.")}</p>
          </div>
          {submitted && <p className="tip-form-status" role="status">{preventOrphan("The form layout is ready. Connect a form service to begin receiving submissions.")}</p>}
        </form>
      </section>
    </>
  );
}

function NewsPage({ page }) {
  return (
    <>
      <section className="news-index-hero shell">
        <div>
          <span className="page-type">Latest reporting</span>
          <h1>News</h1>
        </div>
        <p>{preventOrphan(page.description || "Reporting and investigations about education freedom, public schools, and the policies affecting families across America.")}</p>
      </section>
      <section className="news-index shell" aria-label="Education news articles">
        <div className="news-index-heading">
          <span>{newsArticles.length} articles</span>
          <p>{preventOrphan("Reporting from Restoration News")}</p>
        </div>
        <div className="news-index-grid">
          {newsArticles.map((article, index) => (
            <a
              className={`news-index-card ${index === 0 ? "news-index-featured" : ""}`}
              href={article.href}
              target="_blank"
              rel="noreferrer"
              key={article.href}
            >
              <img src={article.image} alt="" loading={index === 0 ? "eager" : "lazy"} />
              <div className="news-index-card-copy">
                <span>Restoration News</span>
                <h2>{preventOrphan(article.title)}</h2>
                <p>{preventOrphan(article.summary)}</p>
                <strong>{preventOrphan("Read article")} <ArrowRight size={17} /></strong>
              </div>
            </a>
          ))}
        </div>
        <div className="news-index-more">
          <a
            className="primary-button"
            href="https://restoration-news.com/search?s=desc&ps=12&searchText=&c=Big%20Education&a="
            target="_blank"
            rel="noreferrer"
          >
            {preventOrphan("Read more")} <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </>
  );
}

function StandardPage({ page }) {
  const children = page.childIds.map((id) => pageById.get(id)).filter(Boolean);
  const grading = page.kind === "grading";
  const displayTitle = grading ? "Education Freedom State Scores" : page.title;
  const displayDescription = grading
    ? "See how states support education freedom through school choice, portable funding, and protections for homeschooling."
    : page.description;
  const portrait = grading ? null : page.images[0]?.src;
  return (
    <>
      <section className={`page-hero shell ${grading ? "grading-hero" : ""} ${portrait && ["profile", "policy", "post"].includes(page.kind) ? "profile-hero" : ""} ${page.kind === "profile" ? "person-profile-hero" : ""} ${page.kind === "policy" ? "policy-page-hero" : ""}`}>
        <div>
          <DistrictBreadcrumb page={page} />
          <span className="page-type">{grading ? "State scoring methodology" : page.kind.replaceAll("-", " ")}</span>
          <h1>{displayTitle}</h1>
          {displayDescription && <p>{preventOrphan(grading ? displayDescription : clampWords(displayDescription, 20))}</p>}
          {page.profileStatusDetail && (
            <div className="profile-status-notice" role="note" aria-label="Profile status update">
              <span>{page.profileStatus}</span>
              <strong>{page.profileStatusDetail}</strong>
            </div>
          )}
        </div>
        {grading && (
          <div className="grading-scale" aria-label="Grade scale: A, B, C, D, and F">
            {["A", "B", "C", "D", "F"].map((grade) => <strong className={`grade grade-${grade.toLowerCase()}`} key={grade}>{grade}</strong>)}
          </div>
        )}
        {portrait && <img src={portrait} alt={page.images[0].alt || page.title} />}
      </section>
      {children.length > 0 && <section className="child-links shell">{children.map((child) => <Link key={child.id} to={child.route}>{child.title}<ArrowRight size={18} /></Link>)}</section>}
      <main className="content-shell shell">
        <MarkdownBody page={page} stripFirstImage={grading || page.kind === "profile"} />
        {grading && (
          <section className="grading-map-section" aria-labelledby="grading-map-title">
            <div className="grading-map-heading">
              <h2 id="grading-map-title">Explore the state scores</h2>
              <p>{preventOrphan("Select a state to open its full education freedom report.")}</p>
            </div>
            <StateGradesMap states={gradedStates} />
          </section>
        )}
      </main>
    </>
  );
}

function NotFound() {
  return <main className="not-found shell"><strong>404</strong><h1>That page is not in this design yet.</h1><p>{preventOrphan("Try the site search or return to the homepage.")}</p><Link className="primary-button" to="/">{preventOrphan("Go home")} <ArrowRight size={18} /></Link></main>;
}

function LoadingPage() {
  return <main className="loading-page shell" aria-live="polite"><div className="loading-title" /><div className="loading-line" /><div className="loading-line short" /><span className="sr-only">Loading page</span></main>;
}

function LoadError({ retry }) {
  return <main className="not-found shell"><strong>Page unavailable</strong><h1>The content did not load.</h1><p>{preventOrphan("Check the local preview server and try again.")}</p><button className="primary-button" onClick={retry}>{preventOrphan("Try again")}</button></main>;
}

function PageRouter() {
  const location = useLocation();
  const route = normalizeRoute(location.pathname);
  const pageMeta = pageByRoute.get(route);
  const [page, setPage] = useState(() => pageMeta && ["home", "district-watch"].includes(pageMeta.kind) ? pageMeta : null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const pageTitle = pageMeta?.kind === "grading" ? "Education Freedom State Scores" : pageMeta?.title;
    document.title = pageTitle ? `${pageTitle} | Restoration of Education` : "Restoration of Education";
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!pageMeta) return;
    if (["home", "district-watch"].includes(pageMeta.kind)) {
      setPage(pageMeta);
      setError(false);
      return;
    }
    let cancelled = false;
    setPage(null);
    setError(false);
    fetch(`/content/${pageMeta.id}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
        return response.json();
      })
      .then((fullPage) => { if (!cancelled) setPage(fullPage); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [pageMeta?.id, attempt]);
  if (!pageMeta) return <NotFound />;
  if (error) return <LoadError retry={() => setAttempt((value) => value + 1)} />;
  if (!page) return <LoadingPage />;
  if (page.kind === "home") return <HomePage />;
  if (page.kind === "state") return <StatePage page={page} />;
  if (page.kind === "news") return <NewsPage page={page} />;
  if (page.kind === "district-watch") return <DistrictWatchPage page={page} />;
  if (page.route === "/district-watch/got-a-tip/") return <TipPage />;
  if (page.kind === "directory") return <DirectoryPage page={page} />;
  return <StandardPage page={page} />;
}

export default function App() {
  return <div className="app"><Header /><main id="main-content"><PageRouter /></main><Footer /></div>;
}
