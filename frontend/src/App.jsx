import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import MintInvoice from "./pages/MintInvoice";
import SignInvoice from "./pages/SignInvoice";
import Marketplace from "./pages/Marketplace";
import MyInvoices  from "./pages/MyInvoices";
import Dashboard   from "./pages/Dashboard";

function Sidebar() {
  const loc = useLocation();
  const links = [
    { to: "/",           icon: "⊞", label: "Dashboard"       },
    { to: "/create",     icon: "＋", label: "Create Invoice"  },
    { to: "/sign",       icon: "✓",  label: "Sign Invoice"    },
    { to: "/marketplace",icon: "◈",  label: "Marketplace"     },
    { to: "/invoices",   icon: "≡",  label: "My Invoices"     },
  ];
  return (
    <aside style={{
      width: 230, minHeight: "100vh", background: "#1e293b",
      display: "flex", flexDirection: "column", flexShrink: 0,
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #334155" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.3px" }}>
          InvoiceNFT
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          Blockchain Invoice Platform
        </div>
      </div>
      {/* Nav */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        {links.map(l => {
          const active = loc.pathname === l.to;
          return (
            <Link key={l.to} to={l.to} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, marginBottom: 2,
              textDecoration: "none",
              background: active ? "#2563eb" : "transparent",
              color:      active ? "#ffffff"  : "#94a3b8",
              fontSize: 14, fontWeight: active ? 600 : 400,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      {/* Footer */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid #334155" }}>
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
          PES University<br/>NFT Invoice Discounting<br/>IEEE Paper Replica
        </div>
      </div>
    </aside>
  );
}

function Layout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar />
      <main style={{ marginLeft: 230, flex: 1, padding: "32px 36px", maxWidth: "calc(100vw - 230px)" }}>
        {children}
      </main>
    </div>
  );
}

function AppInner() {
  return (
    <Layout>
      <Routes>
        <Route path="/"            element={<Dashboard />}   />
        <Route path="/create"      element={<MintInvoice />} />
        <Route path="/sign"        element={<SignInvoice />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/invoices"    element={<MyInvoices />}  />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
