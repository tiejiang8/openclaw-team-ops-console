import { NavLink, Outlet } from "react-router-dom";

import { RuntimeSourceMarker } from "../components/runtime-source-marker.js";
import { useI18n } from "../lib/i18n.js";

export function ConsoleLayout() {
  const { language, setLanguage, t } = useI18n();
  const navItems = [
    { to: "/", label: t("nav.overview") },
    { to: "/targets", label: t("nav.targets") },
    { to: "/risks", label: t("nav.risks") },
    { to: "/findings", label: t("nav.findings") },
    { to: "/evidence", label: t("nav.evidence") },
    { to: "/agents", label: t("nav.agents") },
    { to: "/workspaces", label: t("nav.workspaces") },
    { to: "/sessions", label: t("nav.sessions") },
    { to: "/bindings", label: t("nav.bindings") },
    { to: "/auth-profiles", label: t("nav.authProfiles") },
    { to: "/topology", label: t("nav.topology") },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar fade-in-up">
        <div>
          <p className="product-eyebrow">{t("product.eyebrow")}</p>
          <h1 className="product-name">{t("product.name")}</h1>
          <p className="product-subtitle">{t("product.subtitle")}</p>
        </div>

        <section className="language-switcher" aria-label={t("language.label")}>
          <p className="language-switcher-label">{t("language.label")}</p>
          <div className="language-switcher-actions">
            <button
              type="button"
              className={`language-button${language === "en" ? " language-button-active" : ""}`}
              onClick={() => setLanguage("en")}
            >
              {t("language.en")}
            </button>
            <button
              type="button"
              className={`language-button${language === "zh" ? " language-button-active" : ""}`}
              onClick={() => setLanguage("zh")}
            >
              {t("language.zh")}
            </button>
          </div>
        </section>

        <RuntimeSourceMarker />

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
