import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { seedDemoData } from "./utils/seed.js";

if (import.meta.env.DEV) {
  window.seedDemo = seedDemoData;
}

const root = document.getElementById("root");

function renderError(message) {
  root.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:2rem; text-align:center; background:#f8fafc; gap:0.75rem;">
      <h1 style="color:#dc2626; font-size:1.5rem; margin:0;">App failed to start</h1>
      <pre style="color:#334155; background:#e2e8f0; padding:1rem; border-radius:0.5rem; max-width:34rem; white-space:pre-wrap; font-size:0.875rem;">${message}</pre>
    </div>
  `;
}

async function startApp() {
  try {
    const { default: App } = await import("./App.jsx");
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Failed to start app:", error);
    renderError(error.message || "Unknown error while starting the app.");
  }
}

startApp();
