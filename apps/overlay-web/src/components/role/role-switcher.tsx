import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n.js";
import { getRoleNavigation, type RoleId } from "../../lib/navigation/role-nav.js";

export function RoleSwitcher({
  activeRoleId,
  onSelectRole,
}: {
  activeRoleId: RoleId;
  onSelectRole: (roleId: RoleId) => void;
}) {
  const { t } = useI18n();
  const roles = getRoleNavigation();

  return (
    <nav className="role-switcher" aria-label={t("nav.primary")}>
      {roles.map((role) => (
        <Link
          key={role.id}
          to={role.to}
          className={`role-switcher-link${activeRoleId === role.id ? " role-switcher-link-active" : ""}`}
          onClick={() => onSelectRole(role.id)}
        >
          <span className="role-switcher-label">{t(role.labelKey)}</span>
          <span className="role-switcher-caption">{t(role.audienceKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
