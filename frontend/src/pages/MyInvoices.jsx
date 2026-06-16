import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { shared, colors } from "../styles";

function StatusBadge({ stage, status }) {
  const s = status === "BURNED" ? { bg: "#fee2e2", color: "#dc2626", label: "Burned" }
    : stage === "MINTED_UNSIGNED"        ? { bg: "#f1f5f9", color: "#64748b", label: "Pending Signature" }
    : stage === "SIGNED_NOT_LISTED"      ? { bg: "#dbeafe", color: "#1d4ed8", label: "Signed" }
    : stage === "LISTED_FOR_SALE"        ? { bg: "#fef9c3", color: "#854d0e", label: "Listed for Sale" }
    : stage === "PURCHASED_BY_FINANCIER" ? { bg: "#f5f3ff", color: "#6d28d9", label: "Awaiting Settlement" }
    : stage === "SETTLED_OWNED_BY_BUYER" ? { bg: "#dcfce7", color: "#15803d", label: "Settled" }
    : { bg: "#f1f5f9", color: "#64748b", label: "Unknown" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function InvoiceCard({ invoice, onSettle, onBurn, onRevoke, settling, burning, callerType, callerKey }) {
  const [open, setOpen] = useState(false);
  const isBurned   = invoice.status === "BURNED";
  const canSettle  = invoice.stage === "PURCHASED_BY_FINANCIER";
  const canBurn    = invoice.stage === "SETTLED_OWNED_BY_BUYER";
  const canRevoke  = invoice.stage === "LISTED_FOR_SALE";

  return (
    <div style={{ ...shared.card, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Invoice #{invoice.tokenId}</span>
          <StatusBadge stage={invoice.stage} status={invoice.status} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>{invoice.invoiceAmount || "?"} ETH</span>
          {canSettle && (
            <button onClick={() => onSettle(invoice.tokenId)} disabled={settling === invoice.tokenId}
              style={{ ...shared.btn("success"), padding: "7px 14px", fontSize: 13, opacity: settling === invoice.tokenId ? 0.6 : 1 }}>
              {settling === invoice.tokenId ? "Processing..." : "Settle Invoice"}
            </button>
          )}
          {canRevoke && (
            <button onClick={() => onRevoke(invoice.tokenId)}
              style={{ ...shared.btn("warning"), padding: "7px 14px", fontSize: 13 }}>
              Remove from Sale
            </button>
          )}
          {canBurn && (
            <button onClick={() => onBurn(invoice.tokenId)} disabled={burning === invoice.tokenId}
              style={{ ...shared.btn("danger"), padding: "7px 14px", fontSize: 13, opacity: burning === invoice.tokenId ? 0.6 : 1 }}>
              {burning === invoice.tokenId ? "Burning..." : "Burn NFT"}
            </button>
          )}
          <button onClick={() => setOpen(!open)}
            style={{ ...shared.btn("outline"), padding: "7px 12px", fontSize: 12 }}>
            {open ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {open && !isBurned && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "6px 10px", fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Supplier</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{invoice.creator}</span>
                <span style={{ color: "#94a3b8" }}>Buyer</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{invoice.buyer}</span>
                <span style={{ color: "#94a3b8" }}>Current Owner</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{invoice.currentOwner}</span>
                <span style={{ color: "#94a3b8" }}>Invoice Amount</span>
                <span style={{ fontWeight: 600 }}>{invoice.invoiceAmount} ETH</span>
                <span style={{ color: "#94a3b8" }}>Current Price</span>
                <span>{invoice.currPrice} ETH</span>
                <span style={{ color: "#94a3b8" }}>Due Date</span>
                <span style={{ fontWeight: 600 }}>{invoice.dueDate}</span>
                <span style={{ color: "#94a3b8" }}>Buyer Signed</span>
                <span style={{ color: invoice.isApproved ? "#15803d" : "#dc2626", fontWeight: 600 }}>
                  {invoice.isApproved ? "Yes ✓" : "No"}
                </span>
                <span style={{ color: "#94a3b8" }}>For Sale</span>
                <span>{invoice.forSale ? "Yes" : "No"}</span>
              </div>
            </div>
            <div>
              {invoice.ipfsUrl && (
                <a href={invoice.ipfsUrl} target="_blank" rel="noreferrer"
                  style={{ display: "block", padding: "10px 14px", background: "#eff6ff", borderRadius: 8, fontSize: 13, color: "#2563eb", textDecoration: "none", marginBottom: 10 }}>
                  📄 View Invoice PDF on IPFS →
                </a>
              )}
              {canSettle && (
                <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#166534" }}>
                  <strong>Ready to settle.</strong> Pay {invoice.invoiceAmount} ETH to the financier
                  to complete the invoice discounting cycle.
                </div>
              )}
              {canBurn && (
                <div style={{ padding: "12px 14px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#854d0e" }}>
                  <strong>Invoice settled.</strong> You can keep this NFT as proof of payment or burn it permanently.
                </div>
              )}
            </div>
          </div>

          {/* Mint tx info */}
          {invoice.mintTxHash && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
              Mint Tx: <span style={{ fontFamily: "monospace" }}>{invoice.mintTxHash}</span>
              {invoice.mintBlock && ` — Block #${invoice.mintBlock}`}
            </div>
          )}
        </div>
      )}

      {open && isBurned && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#94a3b8" }}>
          This NFT has been permanently burned. Mint Tx: <span style={{ fontFamily: "monospace", fontSize: 11 }}>{invoice.mintTxHash}</span>
        </div>
      )}
    </div>
  );
}

function ProfitCalculator() {
  const [form, setForm] = useState({ invoiceAmountEth: "1.0", discountRatePercent: "5", daysUntilDue: "30", gasFeesEth: "0.000263" });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const calc = async e => {
    e.preventDefault();
    setLoading(true); setError(null);
    try { const { data } = await api.calculateProfit(form); setResult(data); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ ...shared.card, marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 6 }}>Profit Calculator</h3>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Estimate financier profit: <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>Profit = (I × R × T) / (100 × 365) − Gas</code>
      </p>
      <form onSubmit={calc}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
          {[
            { name: "invoiceAmountEth",    label: "Invoice Amount (ETH)", placeholder: "1.0"      },
            { name: "discountRatePercent", label: "Discount Rate (%)",    placeholder: "5"         },
            { name: "daysUntilDue",        label: "Days Until Due",       placeholder: "30"        },
            { name: "gasFeesEth",          label: "Gas Fees (ETH)",       placeholder: "0.000263"  },
          ].map(f => (
            <div key={f.name} style={shared.formRow}>
              <label style={shared.label}>{f.label}</label>
              <input type="number" step="any" value={form[f.name]}
                onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                placeholder={f.placeholder} style={shared.input} />
            </div>
          ))}
        </div>
        <button type="submit" disabled={loading} style={{ ...shared.btn("primary"), opacity: loading ? 0.6 : 1 }}>
          {loading ? "Calculating..." : "Calculate Profit"}
        </button>
      </form>
      {error && <div style={shared.errorBox}>❌ {error}</div>}
      {result && (
        <div style={{
          marginTop: 14, padding: 16, borderRadius: 8,
          background: result.isProfitable ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${result.isProfitable ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: result.isProfitable ? "#15803d" : "#dc2626" }}>
            {result.isProfitable ? "✅ Profitable Trade" : "❌ Not Profitable"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px 16px", fontSize: 13 }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 11 }}>ESTIMATED PROFIT</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: result.isProfitable ? "#15803d" : "#dc2626" }}>
                {result.profitEth} ETH
              </div>
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: 11 }}>BREAK-EVEN AMOUNT</div>
              <div style={{ fontWeight: 600 }}>{result.breakEvenEth} ETH</div>
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: 11 }}>FORMULA USED</div>
              <div style={{ fontFamily: "monospace", fontSize: 11 }}>{result.formula}</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            Discount rate has the highest influence on profitability. Higher rate = steeper profit slope.
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyInvoices() {
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [settling, setSettling]   = useState(null);
  const [burning, setBurning]     = useState(null);
  const [txResult, setTxResult]   = useState(null);
  const [callerType, setCallerType] = useState("buyer");
  const [callerKey, setCallerKey] = useState("");
  const [filter, setFilter]       = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { data } = await api.getAllInvoices(); setInvoices(data.invoices || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSettle = async tokenId => {
    setSettling(tokenId); setTxResult(null); setError(null);
    try {
      const body = { callerType };
      if (callerType === "custom") body.callerPrivateKey = callerKey;
      const { data } = await api.settleInvoice(tokenId, body);
      setTxResult({ type: "settle", data }); load();
    } catch (err) { setError(err.message); }
    finally { setSettling(null); }
  };

  const handleBurn = async tokenId => {
    if (!window.confirm(`Permanently burn NFT #${tokenId}? This cannot be undone.`)) return;
    setBurning(tokenId); setTxResult(null); setError(null);
    try {
      const body = { callerType };
      if (callerType === "custom") body.callerPrivateKey = callerKey;
      const { data } = await api.burnInvoiceNFT(tokenId, body);
      setTxResult({ type: "burn", data }); load();
    } catch (err) { setError(err.message); }
    finally { setBurning(null); }
  };

  const handleRevoke = async tokenId => {
    setError(null);
    try {
      const body = { callerType };
      if (callerType === "custom") body.callerPrivateKey = callerKey;
      await api.revokeInvoiceSale(tokenId, body); load();
    } catch (err) { setError(err.message); }
  };

  const filters = [
    { key: "all",       label: "All" },
    { key: "pending",   label: "Pending Signature" },
    { key: "listed",    label: "Listed" },
    { key: "awaiting",  label: "Awaiting Settlement" },
    { key: "settled",   label: "Settled" },
  ];

  const filtered = invoices.filter(inv => {
    if (filter === "all") return true;
    if (filter === "pending")  return inv.stage === "MINTED_UNSIGNED";
    if (filter === "listed")   return inv.stage === "LISTED_FOR_SALE";
    if (filter === "awaiting") return inv.stage === "PURCHASED_BY_FINANCIER";
    if (filter === "settled")  return inv.stage === "SETTLED_OWNED_BY_BUYER" || inv.status === "BURNED";
    return true;
  });

  const counts = {
    all:      invoices.length,
    pending:  invoices.filter(i => i.stage === "MINTED_UNSIGNED").length,
    listed:   invoices.filter(i => i.stage === "LISTED_FOR_SALE").length,
    awaiting: invoices.filter(i => i.stage === "PURCHASED_BY_FINANCIER").length,
    settled:  invoices.filter(i => i.stage === "SETTLED_OWNED_BY_BUYER" || i.status === "BURNED").length,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>My Invoices</h1>
          <p style={{ color: "#64748b", margin: 0 }}>Track all invoice NFTs, settle payments, and calculate profits.</p>
        </div>
        <button onClick={load} style={shared.btn("outline")}>Refresh</button>
      </div>

      <ProfitCalculator />

      {/* Caller role */}
      <div style={{ ...shared.card, padding: "14px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Acting as:</span>
          <select value={callerType} onChange={e => setCallerType(e.target.value)}
            style={{ ...shared.select, width: "auto", minWidth: 220 }}>
            <option value="supplier">Supplier</option>
            <option value="buyer">Buyer</option>
            <option value="financier">Financier</option>
            <option value="custom">Custom (enter key)</option>
          </select>
          {callerType === "custom" && (
            <input type="password" value={callerKey} onChange={e => setCallerKey(e.target.value)}
              placeholder="Private key 0x..." style={{ ...shared.input, width: 260 }} />
          )}
        </div>
      </div>

      {/* Tx results */}
      {txResult?.type === "settle" && (
        <div style={shared.successBox}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>✅ Invoice Settled Successfully</div>
          <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 8px" }}>
            <span>Token ID</span>     <strong>#{txResult.data.tokenId}</strong>
            <span>New Owner</span>    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{txResult.data.newOwner}</span>
            <span>Amount Paid</span>  <span>{txResult.data.settledEth} ETH to Financier</span>
            <span>Transaction</span>  <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{txResult.data.txHash}</span>
          </div>
        </div>
      )}
      {txResult?.type === "burn" && (
        <div style={{ ...shared.successBox, background: "#fef2f2", border: "1px solid #fecaca" }}>
          🔥 NFT #{txResult.data.tokenId} has been permanently burned. Tx: <span style={{ fontFamily: "monospace", fontSize: 11 }}>{txResult.data.txHash}</span>
        </div>
      )}
      {error && <div style={shared.errorBox}>❌ {error}</div>}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: filter === f.key ? "none" : "1px solid #e2e8f0",
              background: filter === f.key ? "#2563eb" : "#ffffff",
              color: filter === f.key ? "#ffffff" : "#64748b",
              cursor: "pointer",
            }}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading invoices from blockchain...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ ...shared.card, textAlign: "center", padding: 48, color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No invoices found</div>
          <div style={{ fontSize: 13 }}>
            {filter === "all" ? "Create your first invoice from the Create Invoice page." : `No invoices in "${filters.find(f=>f.key===filter)?.label}" status.`}
          </div>
        </div>
      )}

      {!loading && filtered.map(inv => (
        <InvoiceCard key={inv.tokenId} invoice={inv}
          onSettle={handleSettle} onBurn={handleBurn} onRevoke={handleRevoke}
          settling={settling} burning={burning}
          callerType={callerType} callerKey={callerKey} />
      ))}
    </div>
  );
}
