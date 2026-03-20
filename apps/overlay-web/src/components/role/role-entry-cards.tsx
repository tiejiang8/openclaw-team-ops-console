import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n.js";
import { getRoleNavigationItem, type RoleId } from "../../lib/navigation/role-nav.js";

export function RoleEntryCards({ roleId }: { roleId: RoleId }) {
  const { t } = useI18n();
  const role = getRoleNavigationItem(roleId);

  if (!role) {
    return null;
  }

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t(role.labelKey)}</h2>
        <p>{t(role.audienceKey)}</p>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h3>{t(role.labelKey)}</h3>
          <p>{t("common.viewDetails")}</p>
        </div>

        <div className="role-entry-grid">
          {role.items.map((item) => (
            <Link key={item.to} className="role-entry-card" to={item.to}>
              <div style={{ display: "grid", gap: 8 }}>
                <p className="metric-label" style={{ margin: 0 }}>
                  {t(role.labelKey)}
                </p>
                <div className="cell-title">{t(item.labelKey)}</div>
                {item.descriptionKey ? (
                  <p className="metric-detail" style={{ margin: 0 }}>
                    {t(item.descriptionKey)}
                  </p>
                ) : null}
              </div>

              <span className="inline-link" style={{ fontWeight: 600 }}>
                {t("common.viewDetails")} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
