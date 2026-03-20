import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { RuntimeStatusBar } from "../components/runtime/runtime-status-bar.js";
import { RuntimeSourceMarker } from "../components/runtime-source-marker.js";
import { useI18n } from "../lib/i18n.js";

interface NavItem {
  to: string;
  label: string;
}

function isNavPathActive(pathname: string, item: NavItem) {
  return pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`));
}

export function ConsoleLayout() {
  const { language, setLanguage, t } = useI18n();
  const { pathname } = useLocation();

  const primaryNavItems: NavItem[] = [
    { to: "/", label: t("nav.overview") },
    { to: "/fleet-map", label: t("nav.fleetMap") },
    { to: "/activity", label: t("nav.activity") },
    { to: "/risks", label: t("nav.risks") },
    { to: "/findings", label: t("nav.findings") },
    { to: "/recommendations", label: t("nav.recommendations") },
  ];

  const resourceNavItems: NavItem[] = [
    { to: "/targets", label: t("nav.targets") },
    { to: "/coverage", label: t("nav.coverage") },
    { to: "/logs", label: t("nav.logs") },
    { to: "/cron", label: t("nav.cron") },
    { to: "/nodes", label: t("nav.nodes") },
    { to: "/evidence", label: t("nav.evidence") },
    { to: "/agents", label: t("nav.agents") },
    { to: "/workspaces", label: t("nav.workspaces") },
    { to: "/sessions", label: t("nav.sessions") },
    { to: "/bindings", label: t("nav.bindings") },
    { to: "/auth-profiles", label: t("nav.authProfiles") },
    { to: "/topology", label: t("nav.topology") },
  ];

  const isResourceRoute = resourceNavItems.some((item) => isNavPathActive(pathname, item));
  const [resourceDetailsExpanded, setResourceDetailsExpanded] = useState(isResourceRoute);

  useEffect(() => {
    if (isResourceRoute) {
      setResourceDetailsExpanded(true);
    }
  }, [isResourceRoute, pathname]);

  return (
    <div className="app-shell">
      <aside className="sidebar fade-in-up" style={{ padding: 20, gap: 16 }}>
        <div style={{ display: "grid", gap: 12, flex: 1, alignContent: "start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <p className="product-eyebrow" style={{ fontSize: "0.68rem" }}>
              {t("product.eyebrow")}
            </p>
            <h1 className="product-name" style={{ marginTop: 2 }}>
              {t("product.name")}
            </h1>
            <p
              className="product-subtitle"
              style={{
                marginTop: 4,
                fontSize: "0.82rem",
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {t("layout.productSubtitleShort")}
            </p>
          </div>

          <section
            className="language-switcher"
            aria-label={t("language.label")}
            style={{ padding: 10, gap: 6, background: "rgba(255, 255, 255, 0.72)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <p className="language-switcher-label" style={{ margin: 0, fontSize: "0.68rem" }}>
                {t("language.label")}
              </p>
              <div className="language-switcher-actions">
                <button
                  type="button"
                  className={`language-button${language === "en" ? " language-button-active" : ""}`}
                  onClick={() => setLanguage("en")}
                  style={{ padding: "6px 8px" }}
                >
                  {t("language.en")}
                </button>
                <button
                  type="button"
                  className={`language-button${language === "zh" ? " language-button-active" : ""}`}
                  onClick={() => setLanguage("zh")}
                  style={{ padding: "6px 8px" }}
                >
                  {t("language.zh")}
                </button>
              </div>
            </div>
          </section>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <p className="language-switcher-label" style={{ margin: 0 }}>
                {t("nav.primary")}
              </p>
              <nav className="nav-list" aria-label={t("nav.primary")} style={{ gap: 6 }}>
                {primaryNavItems.map((item) => (
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
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <button
                type="button"
                className={`nav-link${isResourceRoute ? " nav-link-active" : ""}`}
                aria-expanded={resourceDetailsExpanded}
                aria-controls="resource-details-nav"
                onClick={() => setResourceDetailsExpanded((expanded) => !expanded)}
                style={{
                  width: "100%",
                  background: isResourceRoute ? "var(--accent-soft)" : "transparent",
                  borderColor: isResourceRoute ? "rgba(0, 109, 119, 0.35)" : "transparent",
                  cursor: "pointer",
                  font: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                }}
              >
                <span>{t("nav.resourceDetails")}</span>
                <span aria-hidden="true">{resourceDetailsExpanded ? "−" : "+"}</span>
              </button>

              {resourceDetailsExpanded ? (
                <nav
                  id="resource-details-nav"
                  className="nav-list"
                  aria-label={t("nav.resourceDetails")}
                  style={{ gap: 6, paddingLeft: 8 }}
                >
                  {resourceNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <p className="language-switcher-label" style={{ margin: 0, fontSize: "0.68rem" }}>
            {t("source.title")}
          </p>
          <RuntimeSourceMarker />
        </div>
      </aside>

      <main className="main-content">
        <RuntimeStatusBar />
        <Outlet />
      </main>
    </div>
  );
}
