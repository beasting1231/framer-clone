import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { useEditor } from "./store/editor";
import { useDocument } from "./store/document";
import "./styles/editor.css";

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__stores = { useEditor, useDocument };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
