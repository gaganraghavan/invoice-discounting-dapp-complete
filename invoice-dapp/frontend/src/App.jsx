/**
 * App.jsx — Main application with Unified Interface System
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section IV-A (Unified Interface System):
 *   "All the parties involved in the traditional invoice discounting process
 *    sign in to the same dashboard — no different interface for buyers,
 *    suppliers and financiers."
 *
 *   "Users, whether buyers, suppliers, or financing entities, can effortlessly
 *    engage in various roles within the platform using the same MetaMask wallet."
 *
 * Ownership flow visualized in nav:
 *   Mint(Supplier) → Sign(Buyer) → Marketplace(Financier) → My Invoices(All)
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import MintInvoice from "./components/MintInvoice";
import SignInvoice from "./components/SignInvoice";
import Marketplace from "./components/Marketplace";
import MyInvoices  from "./components/MyInvoices";
import { api }     from "./services/api";
import { colors }  from "./styles";

// ─── Nav link ─────────────────────────────────────────────────────────────────
function NavLink({ to, label, icon, desc }) {
  const location = useLocation();
  const active   = location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        display:         "flex",
        flexDirection:   "column",
        padding:         "8px 14px",
        textDecoration:  "none",
        borderRadius:    6,
        background:      active ? colors.bgHover : "transparent",
        borderBottom:    active ? `2px solid ${colors.blue}` : "2px solid transparent",
        transition:      "background 0.15s",
      }}
    >
      <span style={{ color: active ? colors.textPrimary : colors.textSecondary, fontSize: 14, fontWeight: 600 }}>
        {icon} {label}
      </span>
      <span style={{ color: colors.textMuted, fontSize: 11 }}>{desc}</span>
    </Link>
  );
}

// ─── Status indicator ─────────────────────────────────────────────────────────
function BlockchainStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.healthCheck()
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ blockchain: { connected: false } }));
  }, []);

  if (!status) return null;
  const connected = status.blockchain?.connected;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, color: connected ? colors.greenLight : colors.redLight,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: connected ? colors.greenLight : colors.redLight,
        display: "inline-block",
      }} />
      {connected
        ? `${status.network || "ganache"} — Block ${status.blockchain?.blockNumber}`
        : "Blockchain not connected"}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function AppInner() {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.textPrimary }}>

      {/* Top nav */}
      <nav style={{
        background:    colors.bgCard,
        borderBottom:  `1px solid ${colors.border}`,
        padding:       "0 24px",
        position:      "sticky",
        top:           0,
        zIndex:        100,
      }}>
        {/* Brand row */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "10px 0 6px",
          borderBottom:   `1px solid ${colors.border}`,
        }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16, color: colors.textPrimary }}>
              📄 InvoiceNFT DApp
            </span>
            <span style={{ marginLeft: 10, fontSize: 12, color: colors.textMuted }}>
              PES University — IEEE Paper Replica
            </span>
          </div>
          <BlockchainStatus />
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 4, padding: "6px 0" }}>
          <NavLink to="/"            icon="🪙" label="Mint Invoice"   desc="Algorithm 1 — Supplier" />
          <NavLink to="/sign"        icon="✍️" label="Sign Invoice"   desc="Algorithm 2 — Buyer"    />
          <NavLink to="/marketplace" icon="🏪" label="Marketplace"    desc="Algorithms 3–5"          />
          <NavLink to="/my-invoices" icon="📊" label="My Invoices"    desc="Algorithm 9 + Profit"   />
        </div>
      </nav>

      {/* Ownership flow banner */}
      <div style={{
        background:   "#1c2128",
        borderBottom: `1px solid ${colors.border}`,
        padding:      "8px 24px",
        fontSize:     12,
        color:        colors.textMuted,
        display:      "flex",
        alignItems:   "center",
        gap:          6,
        flexWrap:     "wrap",
      }}>
        <strong style={{ color: colors.textSecondary }}>Ownership journey:</strong>
        <span style={{ color: "#79c0ff" }}>Mint → Supplier</span>
        <span>→</span>
        <span style={{ color: colors.greenLight }}>Sign → Supplier</span>
        <span>→</span>
        <span style={{ color: colors.yellowLight }}>List → Supplier</span>
        <span>→</span>
        <span style={{ color: "#bc8cff" }}>Buy → Financier</span>
        <span>→</span>
        <span style={{ color: colors.greenLight }}>Settle → Buyer</span>
        <span>→</span>
        <span style={{ color: colors.redLight }}>Burn (optional)</span>
        <span style={{ marginLeft: "auto", color: colors.textMuted }}>
          No database — blockchain + IPFS only
        </span>
      </div>

      {/* Page content */}
      <main style={{ maxWidth: 900, margin: "28px auto", padding: "0 20px" }}>
        <Routes>
          <Route path="/"            element={<MintInvoice />} />
          <Route path="/sign"        element={<SignInvoice />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/my-invoices" element={<MyInvoices  />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop:  `1px solid ${colors.border}`,
        padding:    "16px 24px",
        textAlign:  "center",
        fontSize:   12,
        color:      colors.textMuted,
        marginTop:  40,
      }}>
        "A Non-Fungible Token Based Approach to Invoice Discounting" —
        Shruti Jadon, Shashank R, Haria Mehkhad, Vinay Kumar S, Aishwarya N, Prasad B Honnavalli
        · PES University · IEEE
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
