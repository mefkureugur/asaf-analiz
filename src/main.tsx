import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./store/AuthContext"; // 👈 Eklendi
import { DataProvider } from "./store/DataContext";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("Root öğesi bulunamadı.");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {/* 1. Önce kimlik mekanizması başlar */}
    <AuthProvider>
      {/* 2. Sonra kimliğe göre veriler çekilir */}
      <DataProvider>
        {/* 3. En son uygulama bu verilerle açılır */}
        <App />
      </DataProvider>
    </AuthProvider>
  </React.StrictMode>
);