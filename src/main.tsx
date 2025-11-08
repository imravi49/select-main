import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/styles/cinematic.css";
import { initDesignLoader } from "@/lib/designLoader";

initDesignLoader();
createRoot(document.getElementById("root")!).render(<App />);
