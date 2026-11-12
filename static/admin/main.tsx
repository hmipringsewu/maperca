import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "./admin.css";
import { AdminPage } from "./AdminPage";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in static/admin/index.html.");

createRoot(root).render(
  <StrictMode>
    <AdminPage />
  </StrictMode>,
);
