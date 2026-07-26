import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { seedDemoData } from "./utils/seed.js";

if (import.meta.env.DEV) {
  window.seedDemo = seedDemoData;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
