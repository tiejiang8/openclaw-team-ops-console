import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/agents", label: "Agents" },
  { to: "/workspaces", label: "Workspaces" },
  { to: "/sessions", label: "Sessions" },
  { to: "/bindings", label: "Bindings" },
  { to: "/auth-profiles", label: "Auth Profiles" },
  { to: "/topology", label: "Topology" },
];

export function ConsoleLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar fade-in-up">
        <div>
          <p className="product-eyebrow">OpenClaw Team Ops Console</p>
          <h1 className="product-name">OpenClaw Multi-Agent Control</h1>
          <p className="product-subtitle">Read-only operational visibility layer</p>
        </div>

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
