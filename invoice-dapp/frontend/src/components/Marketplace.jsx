/**
 * Marketplace.jsx — Financier marketplace + Algorithm 3/4/5
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section IV (flow):
 *   "Financiers browse marketplace → select invoice → buyInvoice() + ETH"
 *   "ETH transferred to Supplier, NFT ownership transferred to Financier"
 *
 * Also handles:
 *   Algorithm 3 (approveInvoiceSale) — Supplier lists invoice at discounted price
 *   Algorithm 4 (revokeInvoiceSale)  — Owner removes invoice from market
 *   Algorithm 5 (buyInvoice)         — Financier buys invoice NFT
 *
 * Postman equivalent: Figure 14 (listed), Figure 15/16/17/18/19 (buy flow)
 */

import { useState, useEffect, useCallback } from "react";
import { api }                               from "../services/api";
import { shared, colors, stageBadge, callerTypeOptions } from "../styles";

// ─── Stage badge ─────────────────────────────────────────────────────────────
function StageBadge({ stage }) {
  const s = stageBadge[stage] || stageBadge.UNKNOWN;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({ listing, onBuy, onRevoke, buying }) {
  const discount = listing.invoiceAmount > 0
    ? (((listing.invoiceAmount - listing.currPrice) / listing.invoiceAmount) * 100).toFixed(1)
    : 0;

  return (
    <div style={{
      ...shared.card,
      border: `1px solid ${colors.border}`,
      transition: "border-color 0.2s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>
            Token #{listing.tokenId}
          </span>
          <span style={{ marginLeft: 10 }}>
            <StageBadge stage={listing.stage} />
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ffa657" }}>
            {listing.currPrice} ETH
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>
            Face value: {listing.invoiceAmount} ETH
          </div>
          {discount > 0 && (
            <div style={{ fontSize: 12, color: colors.greenLight, fontWeight: 600 }}>
              {discount}% discount
            </div>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "120px 1fr",
        gap: "5px 12px", fontSize: 13, marginBottom: 14,
      }}>
        <span style={{ color: colors.textMuted }}>Due Date</span>
        <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{listing.dueDate}</span>

        <span style={{ color: colors.textMuted }}>Supplier</span>
        <span style={{ color: colors.textPrimary, fontFamily: "monospace", fontSize: 11 }}>
          {listing.creator}
        </span>

        <span style={{ color: colors.textMuted }}>Buyer</span>
        <span style={{ color: colors.textPrimary, fontFamily: "monospace", fontSize: 11 }}>
          {listing.buyer}
        </span>

        <span style={{ color: colors.textMuted }}>isApproved</span>
        <span style={{ color: listing.isApproved ? colors.greenLight : colors.redLight }}>
          {listing.isApproved ? "✅ Yes" : "❌ No"}
        </span>

        {listing.ipfsUrl && (
          <>
            <span style={{ color: colors.textMuted }}>Invoice PDF</span>
            <a
              href={listing.ipfsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#79c0ff", fontSize: 12 }}
            >
              📄 View on IPFS
            </a>
          </>
        )}
      </div>

      {/* Profit estimate (Equation 1 preview) */}
      <div style={{
        background: colors.bgInput, borderRadius: 5, padding: "8px 12px",
        marginBottom: 14, fontSize: 12,
      }}>
        <span style={{ color: colors.textMuted }}>
          💡 <strong style={{ color: colors.textSecondary }}>Profit if you buy now</strong>
          {" "}(Eq. 1 — assumes ~5% discount rate):
          {" "}
          <span style={{ color: colors.greenLight }}>
            {(() => {
              const dueDate = new Date(listing.dueDate.replace(/-(\d{2})-(\d{4})/, "-$2").replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1") || listing.dueDate);
              const days    = Math.max(1, Math.round((dueDate - new Date()) / 86400000));
              const I       = parseFloat(listing.invoiceAmount) || 1;
              const R       = 5;
              const G       = 0.000263;
              const profit  = (I * R * days) / (100 * 365) - G;
              return profit > 0
                ? `+${profit.toFixed(6)} ETH (profitable ✅)`
                : `${profit.toFixed(6)} ETH (not profitable ❌)`;
            })()}
          </span>
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onBuy(listing.tokenId)}
          disabled={buying === listing.tokenId}
          style={{
            ...shared.btn("primary"),
            flex: 1,
            opacity: buying === listing.tokenId ? 0.6 : 1,
          }}
        >
          {buying === listing.tokenId ? "⏳ Buying..." : `🛒 Buy for ${listing.currPrice} ETH`}
        </button>
        <button
          onClick={() => onRevoke(listing.tokenId)}
          style={{ ...shared.btn("danger"), padding: "9px 14px" }}
          title="Revoke from marketplace (owner only)"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── List Invoice for Sale (Algorithm 3) ─────────────────────────────────────
function ListForSale({ onSuccess }) {
  const [form, setForm] = useState({
    tokenId:            "",
    newSellingPriceEth: "",
    callerType:         "supplier",
    callerPrivateKey:   "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [result,  setResult]  = useState(null);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = {
        newSellingPriceEth: form.newSellingPriceEth,
        callerType:         form.callerType,
      };
      if (form.callerType === "custom") body.callerPrivateKey = form.callerPrivateKey;

      const { data } = await api.approveInvoiceSale(parseInt(form.tokenId), body);
      setResult(data);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...shared.card, marginBottom: 24 }}>
      <h3 style={{ color: colors.textPrimary, margin: "0 0 6px" }}>
        List Invoice for Sale
      </h3>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: "0 0 16px" }}>
        <strong style={{ color: colors.yellowLight }}>Algorithm 3</strong> — Supplier sets discounted
        price and lists NFT on marketplace. Requires isApproved=true (buyer must sign first).
      </p>

      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={shared.formRow}>
            <label style={shared.label}>Token ID</label>
            <input
              name="tokenId"
              type="number" min="0"
              value={form.tokenId}
              onChange={handle}
              placeholder="e.g. 28"
              required
              style={shared.input}
            />
          </div>
          <div style={shared.formRow}>
            <label style={shared.label}>Discounted Selling Price (ETH)</label>
            <input
              name="newSellingPriceEth"
              type="number" step="0.0001" min="0.0001"
              value={form.newSellingPriceEth}
              onChange={handle}
              placeholder="e.g. 0.008  (paper Fig 16)"
              required
              style={shared.input}
            />
          </div>
        </div>

        <div style={shared.formRow}>
          <label style={shared.label}>Caller Role</label>
          <select
            name="callerType"
            value={form.callerType}
            onChange={handle}
            style={shared.select}
          >
            {callerTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {form.callerType === "custom" && (
          <div style={shared.formRow}>
            <label style={shared.label}>Private Key</label>
            <input
              name="callerPrivateKey"
              type="password"
              value={form.callerPrivateKey}
              onChange={handle}
              placeholder="0x..."
              style={shared.input}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ ...shared.btn("warning"), opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "⏳ Listing..." : "📢 List for Sale"}
        </button>
      </form>

      {error  && <div style={shared.errorBox}><strong>❌</strong> {error}</div>}
      {result && (
        <div style={shared.successBox}>
          ✅ Listed! Token #{result.tokenId} — Price: {result.discountedPrice} ETH
          | Tx: {result.txHash?.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}

// ─── Main Marketplace Component ───────────────────────────────────────────────
export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [buying,   setBuying]   = useState(null);
  const [buyRole,  setBuyRole]  = useState("financier");
  const [buyKey,   setBuyKey]   = useState("");
  const [error,    setError]    = useState(null);
  const [txResult, setTxResult] = useState(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.getMarketplace();
      setListings(data.listings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  const handleBuy = async (tokenId) => {
    setBuying(tokenId);
    setTxResult(null);
    setError(null);
    try {
      const body = { callerType: buyRole };
      if (buyRole === "custom" && buyKey) body.callerPrivateKey = buyKey;

      const { data } = await api.buyInvoice(tokenId, body);
      setTxResult(data);
      loadListings();
    } catch (err) {
      setError(err.message);
    } finally {
      setBuying(null);
    }
  };

  const handleRevoke = async (tokenId) => {
    setError(null);
    try {
      await api.revokeInvoiceSale(tokenId, { callerType: buyRole });
      loadListings();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: colors.textPrimary, margin: "0 0 6px" }}>
          Invoice Marketplace
        </h2>
        <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
          <strong style={{ color: "#ffa657" }}>Algorithms 3–5</strong> — Supplier lists invoices
          at a discount. Financiers browse and buy. All data from blockchain — no database.
        </p>
      </div>

      {/* List for Sale (Algorithm 3) */}
      <ListForSale onSuccess={loadListings} />

      {/* Buyer role selector for buy/revoke operations */}
      <div style={{ ...shared.card, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 10 }}>
          Buying As (Financier Role)
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            value={buyRole}
            onChange={(e) => setBuyRole(e.target.value)}
            style={{ ...shared.select, width: "auto", flex: 1 }}
          >
            {callerTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {buyRole === "custom" && (
            <input
              type="password"
              value={buyKey}
              onChange={(e) => setBuyKey(e.target.value)}
              placeholder="Private key 0x..."
              style={{ ...shared.input, flex: 1 }}
            />
          )}
          <button
            onClick={loadListings}
            style={{ ...shared.btn("secondary"), whiteSpace: "nowrap" }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Buy success */}
      {txResult && (
        <div style={shared.successBox}>
          <div style={{ fontWeight: 600, color: colors.greenLight, marginBottom: 6 }}>
            ✅ Invoice Purchased — Algorithm 5
          </div>
          <div>Token ID:      #{txResult.tokenId}</div>
          <div>New Owner:     {txResult.newOwner} (Financier)</div>
          <div>Paid:          {txResult.paidEth} ETH → Supplier</div>
          <div>Tx Hash:       {txResult.txHash}</div>
          <div>Gas Used:      {txResult.gasUsed}</div>
          <div style={{ marginTop: 6, color: colors.textMuted, fontSize: 12 }}>
            Next: Buyer settles invoice on due date via &quot;My Invoices&quot; tab (Algorithm 9)
          </div>
        </div>
      )}

      {error && <div style={shared.errorBox}><strong>❌</strong> {error}</div>}

      {/* Listings */}
      <div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 16,
        }}>
          <h3 style={{ color: colors.textPrimary, margin: 0 }}>
            Available Listings
            {!loading && (
              <span style={{
                marginLeft: 8, fontSize: 13, fontWeight: 400,
                color: listings.length > 0 ? colors.greenLight : colors.textMuted,
              }}>
                ({listings.length} {listings.length === 1 ? "invoice" : "invoices"})
              </span>
            )}
          </h3>
        </div>

        {loading && (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 40 }}>
            ⏳ Reading from blockchain...
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div style={{
            ...shared.card, textAlign: "center", color: colors.textMuted,
            padding: 40,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div>No invoices currently listed for sale.</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Supplier must mint, buyer must sign, then supplier lists using the form above.
            </div>
          </div>
        )}

        {!loading && listings.map((listing) => (
          <ListingCard
            key={listing.tokenId}
            listing={listing}
            onBuy={handleBuy}
            onRevoke={handleRevoke}
            buying={buying}
          />
        ))}
      </div>
    </div>
  );
}
