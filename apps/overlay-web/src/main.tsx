import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { I18nProvider } from "./lib/i18n.js";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
