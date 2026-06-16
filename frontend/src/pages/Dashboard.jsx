import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: color + "15",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{icon}</div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label, desc, color }) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: "20px", cursor: "pointer", transition: "box-shadow 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"}
        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: color + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, marginBottom: 12,
        }}>{icon}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{desc}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats]     = useState({ total: 0, forSale: 0, connected: false, block: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.healthCheck(), api.getAllInvoices(), api.getMarketplace()])
      .then(([h, all, mkt]) => {
        setStats({
          total:     all.data.invoices?.length || 0,
          forSale:   mkt.data.listings?.length || 0,
          connected: h.data.blockchain?.connected || false,
          block:     h.data.blockchain?.blockNumber || 0,
          network:   h.data.network || "ganache",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
          Dashboard
        </h1>
        <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
          Welcome to the Invoice Discounting Platform powered by Ethereum blockchain and NFTs.
        </p>
      </div>

      {/* Blockchain status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: stats.connected ? "#f0fdf4" : "#fef2f2",
        border: `1px solid ${stats.connected ? "#bbf7d0" : "#fecaca"}`,
        borderRadius: 8, marginBottom: 28, fontSize: 13,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: stats.connected ? "#16a34a" : "#dc2626", display: "inline-block",
        }} />
        <span style={{ color: stats.connected ? "#15803d" : "#dc2626", fontWeight: 600 }}>
          {stats.connected
            ? `Connected to ${stats.network} — Block #${stats.block}`
            : "Not connected — Start Ganache and backend server"}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Invoices"    value={loading ? "..." : stats.total}   icon="📄" color="#2563eb" sub="NFTs minted on blockchain" />
        <StatCard label="Active Listings"   value={loading ? "..." : stats.forSale} icon="🏷️" color="#d97706" sub="Available in marketplace"  />
        <StatCard label="Network"           value={stats.network || "ganache"}       icon="🔗" color="#16a34a" sub={`Block #${stats.block}`}    />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 16 }}>
          Quick Actions
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <QuickAction to="/create"      icon="📝" color="#2563eb" label="Create Invoice"   desc="Upload PDF and mint as NFT on blockchain" />
          <QuickAction to="/sign"        icon="✍️" color="#16a34a" label="Sign Invoice"     desc="Approve an invoice as the buyer"          />
          <QuickAction to="/marketplace" icon="🏪" color="#d97706" label="Browse Market"    desc="View and buy discounted invoice NFTs"      />
          <QuickAction to="/invoices"    icon="📊" color="#7c3aed" label="My Invoices"      desc="Track and settle your invoices"            />
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 20 }}>How It Works</h2>
        <div style={{ display: "flex", gap: 0, position: "relative" }}>
          {[
            { step: 1, label: "Supplier creates invoice",    desc: "Upload invoice PDF, set buyer address, amount and due date. Invoice is stored on IPFS and minted as NFT.", color: "#2563eb" },
            { step: 2, label: "Buyer signs invoice",         desc: "Buyer approves the invoice NFT confirming they agree to pay the invoice amount on the due date.",           color: "#16a34a" },
            { step: 3, label: "Listed on marketplace",       desc: "Supplier sets a discounted price and lists the signed invoice NFT for financiers to purchase.",             color: "#d97706" },
            { step: 4, label: "Financier buys invoice",      desc: "Financier purchases the NFT at discounted price. ETH is instantly transferred to the supplier.",           color: "#7c3aed" },
            { step: 5, label: "Settlement on due date",      desc: "Buyer pays the full invoice amount to the financier. NFT ownership transfers to buyer as proof.",          color: "#dc2626" },
          ].map((s, i) => (
            <div key={s.step} style={{ flex: 1, paddingRight: i < 4 ? 16 : 0, position: "relative" }}>
              {i < 4 && (
                <div style={{ position: "absolute", top: 20, right: -8, width: 16, color: "#cbd5e1", zIndex: 1, fontSize: 18 }}>→</div>
              )}
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: s.color + "15",
                border: `2px solid ${s.color}`, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, fontWeight: 700, color: s.color, marginBottom: 10,
              }}>{s.step}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
