/**
 * MyInvoices.jsx — Algorithm 9 (settleInvoice) + burn + profit calculator
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Covers:
 *   Dissertation Algorithm 9: settleInvoice — Buyer pays Financier on due date
 *   burnInvoiceNFT — Optional, buyer's choice (dissertation)
 *   Full invoice history (all minted tokens from blockchain)
 *   Profit Calculator — Equation 1: Profit = (I×R×T)/(100×365) - G
 *
 * Ownership journey reference (shown in UI):
 *   mint → sign → list → buy(Financier) → settle(Buyer) → burn(optional)
 */

import { useState, useEffect, useCallback } from "react";
import { api }                               from "../services/api";
import { shared, colors, stageBadge, callerTypeOptions } from "../styles";

// ─── Ownership Journey Visualizer ─────────────────────────────────────────────
function OwnershipJourney({ stage }) {
  const steps = [
    { key: "MINTED_UNSIGNED",        label: "Minted",    owner: "Supplier"  },
    { key: "SIGNED_NOT_LISTED",      label: "Signed",    owner: "Supplier"  },
    { key: "LISTED_FOR_SALE",        label: "Listed",    owner: "Supplier"  },
    { key: "PURCHASED_BY_FINANCIER", label: "Purchased", owner: "Financier" },
    { key: "SETTLED_OWNED_BY_BUYER", label: "Settled",   owner: "Buyer"     },
  ];
  const idx = steps.findIndex((s) => s.key === stage);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: i <= idx ? colors.blue  : colors.bgInput,
            color:      i <= idx ? "#ffffff"     : colors.textMuted,
            border:     i === idx ? `2px solid ${colors.blueHover}` : "2px solid transparent",
          }}>
            {step.label}
            <span style={{ fontSize: 10, display: "block", fontWeight: 400 }}>
              {step.owner}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span style={{ color: colors.border, margin: "0 2px" }}>→</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Invoice Detail Card ──────────────────────────────────────────────────────
function InvoiceCard({ invoice, onSettle, onBurn, settling, burning }) {
  const [expanded, setExpanded] = useState(false);
  const s = stageBadge[invoice.stage || (invoice.status === "BURNED" ? "BURNED" : "UNKNOWN")];

  const isBurned   = invoice.status === "BURNED";
  const canSettle  = invoice.stage === "PURCHASED_BY_FINANCIER";
  const canBurn    = invoice.stage === "SETTLED_OWNED_BY_BUYER";

  return (
    <div style={{ ...shared.card, marginBottom: 12 }}>
      {/* Header */}
      <div
        style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", alignItems: "center" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>
            Token #{invoice.tokenId}
          </span>
          <span style={{
            padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: s?.bg || colors.bgInput, color: s?.color || colors.textMuted,
          }}>
            {s?.label || invoice.status || "Unknown"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#ffa657", fontWeight: 700 }}>
            {invoice.invoiceAmount || "?"} ETH
          </span>
          <span style={{ color: colors.textMuted, fontSize: 18 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && !isBurned && (
        <div style={{ marginTop: 14 }}>
          {/* Ownership journey */}
          {invoice.stage && <OwnershipJourney stage={invoice.stage} />}

          {/* Metadata */}
          <div style={{
            display: "grid", gridTemplateColumns: "130px 1fr",
            gap: "5px 12px", fontSize: 13, marginBottom: 14,
          }}>
            <span style={{ color: colors.textMuted }}>Supplier</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: colors.textPrimary }}>
              {invoice.creator}
            </span>
            <span style={{ color: colors.textMuted }}>Buyer</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: colors.textPrimary }}>
              {invoice.buyer}
            </span>
            <span style={{ color: colors.textMuted }}>Current Owner</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: colors.textPrimary }}>
              {invoice.currentOwner}
            </span>
            <span style={{ color: colors.textMuted }}>Invoice Amount</span>
            <span style={{ color: "#ffa657" }}>{invoice.invoiceAmount} ETH</span>
            <span style={{ color: colors.textMuted }}>Curr Price</span>
            <span style={{ color: colors.textPrimary }}>{invoice.currPrice} ETH</span>
            <span style={{ color: colors.textMuted }}>Due Date</span>
            <span style={{ color: colors.textPrimary }}>{invoice.dueDate}</span>
            <span style={{ color: colors.textMuted }}>isApproved</span>
            <span style={{ color: invoice.isApproved ? colors.greenLight : colors.redLight }}>
              {invoice.isApproved ? "✅ true" : "❌ false"}
            </span>
            <span style={{ color: colors.textMuted }}>forSale</span>
            <span style={{ color: invoice.forSale ? colors.yellowLight : colors.textMuted }}>
              {invoice.forSale ? "🟡 true" : "false"}
            </span>
            {invoice.ipfsUrl && (
              <>
                <span style={{ color: colors.textMuted }}>Invoice PDF</span>
                <a href={invoice.ipfsUrl} target="_blank" rel="noreferrer"
                  style={{ color: "#79c0ff", fontSize: 12 }}>
                  📄 View on IPFS
                </a>
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            {canSettle && (
              <button
                onClick={() => onSettle(invoice.tokenId)}
                disabled={settling === invoice.tokenId}
                style={{
                  ...shared.btn("success"),
                  opacity: settling === invoice.tokenId ? 0.6 : 1,
                  flex: 1,
                }}
              >
                {settling === invoice.tokenId
                  ? "⏳ Settling..."
                  : `💰 Settle Invoice — Pay ${invoice.invoiceAmount} ETH to Financier`}
              </button>
            )}
            {canBurn && (
              <button
                onClick={() => onBurn(invoice.tokenId)}
                disabled={burning === invoice.tokenId}
                style={{
                  ...shared.btn("danger"),
                  opacity: burning === invoice.tokenId ? 0.6 : 1,
                }}
                title="Optional: burn NFT after settlement (dissertation)"
              >
                {burning === invoice.tokenId ? "⏳..." : "🔥 Burn NFT (Optional)"}
              </button>
            )}
          </div>

          {canSettle && (
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
              Dissertation Algorithm 9: Buyer pays full invoice amount ({invoice.invoiceAmount} ETH) to
              Financier. NFT ownership transfers to Buyer.
            </div>
          )}
          {canBurn && (
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
              Optional (dissertation): Buyer can keep NFT as proof of payment or burn it — their own choice.
            </div>
          )}
        </div>
      )}
      {expanded && isBurned && (
        <div style={{ marginTop: 10, color: colors.textMuted, fontSize: 13 }}>
          🔥 This NFT has been burned. Tx: {invoice.mintTxHash?.slice(0, 30)}...
        </div>
      )}
    </div>
  );
}

// ─── Profit Calculator — Equation 1 ──────────────────────────────────────────
function ProfitCalculator() {
  const [form, setForm] = useState({
    invoiceAmountEth:    "1.0",
    discountRatePercent: "5",
    daysUntilDue:        "30",
    gasFeesEth:          "0.000263",
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const calculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.calculateProfit(form);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...shared.card, marginBottom: 24 }}>
      <h3 style={{ color: colors.textPrimary, margin: "0 0 6px" }}>
        Profit Calculator — Equation 1
      </h3>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: "0 0 16px" }}>
        Paper Section VII-A:&nbsp;
        <code style={{ background: colors.bgInput, padding: "2px 6px", borderRadius: 4, color: "#79c0ff" }}>
          Profit = (I × R × T) / (100 × 365) − G
        </code>
        &nbsp;Gas ref (Table 2): Financier pays ~$0.60 total ≈ 0.000263 ETH at $2279.23/ETH.
      </p>

      <form onSubmit={calculate}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={shared.formRow}>
            <label style={shared.label}>I — Invoice Amount (ETH)</label>
            <input name="invoiceAmountEth" type="number" step="0.001"
              value={form.invoiceAmountEth} onChange={handle} style={shared.input} />
          </div>
          <div style={shared.formRow}>
            <label style={shared.label}>R — Discount Rate (%)</label>
            <input name="discountRatePercent" type="number" step="0.1" min="0.1"
              value={form.discountRatePercent} onChange={handle} style={shared.input} />
          </div>
          <div style={shared.formRow}>
            <label style={shared.label}>T — Days Until Due</label>
            <input name="daysUntilDue" type="number" min="1"
              value={form.daysUntilDue} onChange={handle} style={shared.input} />
          </div>
          <div style={shared.formRow}>
            <label style={shared.label}>G — Gas Fees (ETH)</label>
            <input name="gasFeesEth" type="number" step="0.000001" min="0"
              value={form.gasFeesEth} onChange={handle} style={shared.input} />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ ...shared.btn("primary"), opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "⏳ Calculating..." : "📊 Calculate Profit"}
        </button>
      </form>

      {error  && <div style={shared.errorBox}><strong>❌</strong> {error}</div>}

      {result && (
        <div style={{
          ...shared.successBox,
          background: result.isProfitable ? "#1c3a2a" : "#3a1c1c",
          borderColor: result.isProfitable ? colors.green : colors.red,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8,
            color: result.isProfitable ? colors.greenLight : colors.redLight }}>
            {result.isProfitable ? "✅ Profitable Trade" : "❌ Not Profitable"}
          </div>
          <div>Formula:          {result.formula}</div>
          <div>Profit:           <strong style={{ color: result.isProfitable ? colors.greenLight : colors.redLight }}>
            {result.profitEth} ETH</strong>
          </div>
          <div>Break-even (I):   {result.breakEvenEth} ETH</div>
          <div>Slope (R×T/36500): {result.slope}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
            {result.paperNote}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main MyInvoices Component ────────────────────────────────────────────────
export default function MyInvoices() {
  const [invoices,  setInvoices]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [settling,  setSettling]  = useState(null);
  const [burning,   setBurning]   = useState(null);
  const [txResult,  setTxResult]  = useState(null);
  const [callerType, setCallerType] = useState("buyer");
  const [callerKey,  setCallerKey]  = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.getAllInvoices();
      setInvoices(data.invoices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSettle = async (tokenId) => {
    setSettling(tokenId);
    setTxResult(null);
    setError(null);
    try {
      const body = { callerType };
      if (callerType === "custom" && callerKey) body.callerPrivateKey = callerKey;

      const { data } = await api.settleInvoice(tokenId, body);
      setTxResult({ type: "settle", data });
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSettling(null);
    }
  };

  const handleBurn = async (tokenId) => {
    if (!window.confirm(`Burn Token #${tokenId}? This is permanent and irreversible.`)) return;
    setBurning(tokenId);
    setTxResult(null);
    setError(null);
    try {
      const body = { callerType };
      if (callerType === "custom" && callerKey) body.callerPrivateKey = callerKey;

      const { data } = await api.burnInvoiceNFT(tokenId, body);
      setTxResult({ type: "burn", data });
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBurning(null);
    }
  };

  // Group invoices by stage for summary
  const summary = invoices.reduce((acc, inv) => {
    const key = inv.status || inv.stage || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: colors.textPrimary, margin: "0 0 6px" }}>
          My Invoices & Settlement
        </h2>
        <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
          <strong style={{ color: colors.greenLight }}>Algorithm 9</strong> — Settle invoices on due date.
          All history read from blockchain — immutable audit trail (paper Section VII-B).
        </p>
      </div>

      {/* Profit Calculator */}
      <ProfitCalculator />

      {/* Caller role for settle/burn */}
      <div style={{ ...shared.card, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 10 }}>
          Acting As (for Settle / Burn operations)
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            value={callerType}
            onChange={(e) => setCallerType(e.target.value)}
            style={{ ...shared.select, flex: 1 }}
          >
            {callerTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {callerType === "custom" && (
            <input
              type="password"
              value={callerKey}
              onChange={(e) => setCallerKey(e.target.value)}
              placeholder="Private key 0x..."
              style={{ ...shared.input, flex: 1 }}
            />
          )}
          <button
            onClick={loadAll}
            style={{ ...shared.btn("secondary"), whiteSpace: "nowrap" }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tx result */}
      {txResult?.type === "settle" && (
        <div style={shared.successBox}>
          <div style={{ fontWeight: 600, color: colors.greenLight, marginBottom: 6 }}>
            ✅ Invoice Settled — Dissertation Algorithm 9
          </div>
          <div>Token ID:     #{txResult.data.tokenId}</div>
          <div>New Owner:    {txResult.data.newOwner} (Buyer)</div>
          <div>Settled:      {txResult.data.settledEth} ETH → Financier</div>
          <div>Tx Hash:      {txResult.data.txHash}</div>
          <div>Gas Used:     {txResult.data.gasUsed}</div>
          <div style={{ marginTop: 6, color: colors.textMuted, fontSize: 12 }}>
            Ownership journey complete. Buyer can optionally burn the NFT.
          </div>
        </div>
      )}
      {txResult?.type === "burn" && (
        <div style={{ ...shared.successBox, background: "#3a1c1c", borderColor: colors.red }}>
          🔥 Token #{txResult.data.tokenId} burned permanently. Tx: {txResult.data.txHash}
        </div>
      )}

      {error && <div style={shared.errorBox}><strong>❌</strong> {error}</div>}

      {/* Summary */}
      {invoices.length > 0 && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20,
        }}>
          {Object.entries(summary).map(([stage, count]) => {
            const s = stageBadge[stage] || stageBadge.UNKNOWN;
            return (
              <div key={stage} style={{
                padding: "4px 12px", borderRadius: 12, fontSize: 12,
                background: s.bg, color: s.color, fontWeight: 600,
              }}>
                {s.label}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice list */}
      {loading && (
        <div style={{ color: colors.textMuted, textAlign: "center", padding: 40 }}>
          ⏳ Reading all invoices from blockchain...
        </div>
      )}

      {!loading && invoices.length === 0 && (
        <div style={{ ...shared.card, textAlign: "center", color: colors.textMuted, padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div>No invoices minted yet.</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Go to &quot;Mint Invoice&quot; tab to create the first NFT (Algorithm 1).
          </div>
        </div>
      )}

      {!loading && invoices.map((invoice) => (
        <InvoiceCard
          key={invoice.tokenId}
          invoice={invoice}
          onSettle={handleSettle}
          onBurn={handleBurn}
          settling={settling}
          burning={burning}
        />
      ))}
    </div>
  );
}
