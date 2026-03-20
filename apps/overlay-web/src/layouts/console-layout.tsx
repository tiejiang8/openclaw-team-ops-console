import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { RefreshModePicker } from "../components/refresh/refresh-mode-picker.js";
import { RoleSwitcher } from "../components/role/role-switcher.js";
import { RuntimeStatusBar } from "../components/runtime/runtime-status-bar.js";
import { RuntimeSourceMarker } from "../components/runtime-source-marker.js";
import { useI18n } from "../lib/i18n.js";
import {
  getRoleNavigationItem,
  getStoredRoleId,
  persistRoleId,
  resolveRoleId,
  type RoleId,
} from "../lib/navigation/role-nav.js";

export function ConsoleLayout() {
  const { language, setLanguage, t } = useI18n();
  const { pathname } = useLocation();
  const [activeRoleId, setActiveRoleId] = useState<RoleId>(() => resolveRoleId(pathname, getStoredRoleId()));

  useEffect(() => {
    setActiveRoleId((currentRoleId) => resolveRoleId(pathname, currentRoleId));
  }, [pathname]);

  useEffect(() => {
    persistRoleId(activeRoleId);
  }, [activeRoleId]);

  const activeRole = getRoleNavigationItem(activeRoleId) ?? getRoleNavigationItem("overview");

  if (!activeRole) {
    return null;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar fade-in-up" style={{ padding: 20, gap: 16 }}>
        <div style={{ display: "grid", gap: 14, flex: 1, alignContent: "start" }}>
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

          <div style={{ display: "grid", gap: 8 }}>
            <p className="language-switcher-label" style={{ margin: 0 }}>
              {t("nav.primary")}
            </p>
            <RoleSwitcher activeRoleId={activeRoleId} onSelectRole={setActiveRoleId} />
          </div>

          <div className="role-context-panel">
            <div style={{ display: "grid", gap: 4 }}>
              <p className="language-switcher-label" style={{ margin: 0 }}>
                {t(activeRole.labelKey)}
              </p>
              <p className="role-context-copy">{t(activeRole.audienceKey)}</p>
            </div>

            <nav className="nav-list" aria-label={t(activeRole.labelKey)} style={{ gap: 6 }}>
              {activeRole.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
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

          <RefreshModePicker />
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
