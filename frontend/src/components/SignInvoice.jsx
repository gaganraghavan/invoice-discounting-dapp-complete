/**
 * SignInvoice.jsx — Algorithm 2: signInvoice
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section IV-B-2:
 *   Buyer signs the invoice NFT using their Ethereum address.
 *   Sets isApproved=true. Ownership unchanged (still Supplier).
 *   NFT gains intrinsic value equivalent to the invoice amount.
 *   Only signed invoices can be listed for sale (Algorithm 3 gate).
 *
 * Postman equivalent: Figure 10 (wrong buyer rejected), Figure 11 (metadata after sign).
 */

import { useState } from "react";
import { api }      from "../services/api";
import { shared, colors, callerTypeOptions } from "../styles";

export default function SignInvoice() {
  const [tokenId,   setTokenId]   = useState("");
  const [callerType, setCallerType] = useState("buyer");
  const [privateKey, setPrivateKey] = useState("");
  const [result,    setResult]    = useState(null);
  const [metadata,  setMetadata]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // Also load current metadata so user can verify invoice before signing
  const loadMetadata = async () => {
    if (!tokenId) return;
    try {
      const { data } = await api.getInvoiceMetadata(parseInt(tokenId));
      setMetadata(data.data);
    } catch (err) {
      setMetadata(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = { callerType };
      if (callerType === "custom" && privateKey) body.callerPrivateKey = privateKey;

      const { data } = await api.signInvoice(parseInt(tokenId), body);
      setResult(data);

      // Reload metadata to show updated state (isApproved=true)
      const meta = await api.getInvoiceMetadata(parseInt(tokenId));
      setMetadata(meta.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: colors.textPrimary, margin: "0 0 6px" }}>
          Sign Invoice NFT
        </h2>
        <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
          <strong style={{ color: colors.greenLight }}>Algorithm 2</strong> — Section IV-B-2.
          Buyer signs the invoice, confirming they agree to pay the invoice amount on the due date.
          Only the designated buyer address (set at mint) can sign.
        </p>
      </div>

      {/* Info box */}
      <div style={{
        background: "#1c3a2a", border: `1px solid ${colors.green}`,
        borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 13,
        color: colors.greenLight,
      }}>
        ✍️ After signing: <strong>isApproved=true</strong>. Ownership unchanged (still Supplier).
        NFT gains intrinsic value = invoice amount. Supplier can now list it for sale.
      </div>

      <form onSubmit={submit}>
        {/* Token ID */}
        <div style={shared.formRow}>
          <label style={shared.label}>Invoice Token ID</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min="0"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="e.g. 28  (paper example token)"
              required
              style={{ ...shared.input, flex: 1 }}
            />
            <button
              type="button"
              onClick={loadMetadata}
              style={{ ...shared.btn("secondary"), whiteSpace: "nowrap", padding: "9px 14px" }}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Invoice preview */}
        {metadata && (
          <div style={{
            background: colors.bgInput, border: `1px solid ${colors.border}`,
            borderRadius: 6, padding: 14, marginBottom: 16, fontSize: 13,
          }}>
            <div style={{ fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>
              Invoice Preview (from blockchain)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
              <span style={{ color: colors.textMuted }}>Supplier:</span>
              <span style={{ color: colors.textPrimary, fontFamily: "monospace", fontSize: 11 }}>
                {metadata.creator?.slice(0, 18)}...
              </span>
              <span style={{ color: colors.textMuted }}>Buyer:</span>
              <span style={{ color: colors.textPrimary, fontFamily: "monospace", fontSize: 11 }}>
                {metadata.buyer?.slice(0, 18)}...
              </span>
              <span style={{ color: colors.textMuted }}>Amount:</span>
              <span style={{ color: "#ffa657" }}>{metadata.invoiceAmount} ETH</span>
              <span style={{ color: colors.textMuted }}>Due Date:</span>
              <span style={{ color: colors.textPrimary }}>{metadata.dueDate}</span>
              <span style={{ color: colors.textMuted }}>isApproved:</span>
              <span style={{ color: metadata.isApproved ? colors.greenLight : colors.redLight }}>
                {metadata.isApproved ? "✅ true" : "❌ false"}
              </span>
              <span style={{ color: colors.textMuted }}>forSale:</span>
              <span style={{ color: metadata.forSale ? colors.yellowLight : colors.textMuted }}>
                {metadata.forSale ? "🟡 true" : "false"}
              </span>
            </div>
            {metadata.isApproved && (
              <div style={{ marginTop: 8, color: colors.yellowLight, fontSize: 12 }}>
                ⚠️ This invoice is already signed. Calling signInvoice again will revert.
              </div>
            )}
          </div>
        )}

        {/* Caller — should be buyer */}
        <div style={shared.formRow}>
          <label style={shared.label}>Caller Role (must be Buyer)</label>
          <select
            value={callerType}
            onChange={(e) => setCallerType(e.target.value)}
            style={shared.select}
          >
            {callerTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            Only the buyer address set at mint can sign — any other address will be rejected
          </span>
        </div>

        {callerType === "custom" && (
          <div style={shared.formRow}>
            <label style={shared.label}>Private Key (Buyer)</label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x..."
              style={shared.input}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...shared.btn("success"),
            opacity: loading ? 0.6 : 1,
            width: "100%",
            padding: "11px",
            fontSize: 15,
          }}
        >
          {loading ? "⏳ Signing on Blockchain..." : "✍️ Sign Invoice (Approve)"}
        </button>
      </form>

      {error  && <div style={shared.errorBox}><strong>❌ Error:</strong> {error}</div>}

      {result && (
        <div style={shared.successBox}>
          <div style={{ marginBottom: 8, fontSize: 14, fontFamily: "sans-serif", fontWeight: 600, color: colors.greenLight }}>
            ✅ Invoice Signed Successfully — Algorithm 2
          </div>
          <div>Token ID:    #{result.tokenId}</div>
          <div>Tx Hash:     {result.txHash}</div>
          <div>isApproved:  <strong style={{ color: colors.greenLight }}>true ✅</strong></div>
          <div>Ownership:   Supplier (unchanged)</div>
          <div>Gas Used:    {result.gasUsed}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
            Next step: Supplier should go to &quot;List for Sale&quot; tab to discount and list this NFT (Algorithm 3)
          </div>
        </div>
      )}
    </div>
  );
}
