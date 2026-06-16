import { useState } from "react";
import { api } from "../services/api";
import { shared, colors } from "../styles";

export default function SignInvoice() {
  const [tokenId, setTokenId]     = useState("");
  const [callerType, setCallerType] = useState("buyer");
  const [privateKey, setPrivateKey] = useState("");
  const [metadata, setMetadata]   = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const loadMetadata = async () => {
    if (!tokenId) return;
    setMetaLoading(true);
    try {
      const { data } = await api.getInvoiceMetadata(parseInt(tokenId));
      setMetadata(data.data);
    } catch { setMetadata(null); }
    finally { setMetaLoading(false); }
  };

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const body = { callerType };
      if (callerType === "custom") body.callerPrivateKey = privateKey;
      const { data } = await api.signInvoice(parseInt(tokenId), body);
      setResult(data);
      const meta = await api.getInvoiceMetadata(parseInt(tokenId));
      setMetadata(meta.data.data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const StatusBadge = ({ val }) => (
    <span style={{
      padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: val ? "#dcfce7" : "#fee2e2", color: val ? "#15803d" : "#dc2626",
    }}>{val ? "Yes" : "No"}</span>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Sign Invoice</h1>
        <p style={{ color: "#64748b", margin: 0 }}>As the buyer, approve an invoice NFT to confirm you agree to pay on the due date.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        <div>
          <div style={shared.card}>
            <form onSubmit={submit}>
              <div style={shared.formRow}>
                <label style={shared.label}>Invoice Token ID *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" min="0" value={tokenId} required
                    onChange={e => setTokenId(e.target.value)}
                    placeholder="Enter the token ID (e.g. 0)"
                    style={{ ...shared.input, flex: 1 }} />
                  <button type="button" onClick={loadMetadata}
                    style={{ ...shared.btn("outline"), whiteSpace: "nowrap", padding: "10px 16px" }}>
                    {metaLoading ? "Loading..." : "Preview"}
                  </button>
                </div>
              </div>

              {/* Metadata preview */}
              {metadata && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Invoice Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 12px", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Supplier</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{metadata.creator}</span>
                    <span style={{ color: "#64748b" }}>Buyer</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{metadata.buyer}</span>
                    <span style={{ color: "#64748b" }}>Invoice Amount</span>
                    <span style={{ fontWeight: 600 }}>{metadata.invoiceAmount} ETH</span>
                    <span style={{ color: "#64748b" }}>Due Date</span>
                    <span>{metadata.dueDate}</span>
                    <span style={{ color: "#64748b" }}>Signed</span>
                    <StatusBadge val={metadata.isApproved} />
                    <span style={{ color: "#64748b" }}>For Sale</span>
                    <StatusBadge val={metadata.forSale} />
                  </div>
                  {metadata.isApproved && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef9c3", borderRadius: 6, fontSize: 12, color: "#713f12" }}>
                      ⚠️ This invoice has already been signed.
                    </div>
                  )}
                </div>
              )}

              <div style={shared.formRow}>
                <label style={shared.label}>Acting As</label>
                <select value={callerType} onChange={e => setCallerType(e.target.value)} style={shared.select}>
                  <option value="supplier">Supplier</option>
                  <option value="buyer">Buyer</option>
                  <option value="financier">Financier</option>
                  <option value="custom">Custom (enter private key)</option>
                </select>
                <span style={{ fontSize: 12, color: colors.textMuted }}>Only the buyer address set during invoice creation can sign.</span>
              </div>

              {callerType === "custom" && (
                <div style={shared.formRow}>
                  <label style={shared.label}>Private Key</label>
                  <input type="password" value={privateKey} onChange={e => setPrivateKey(e.target.value)}
                    placeholder="0x..." style={shared.input} />
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ ...shared.btn("success"), width: "100%", padding: 12, fontSize: 15, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Signing on blockchain..." : "Sign & Approve Invoice"}
              </button>
            </form>

            {error  && <div style={shared.errorBox}>❌ {error}</div>}
            {result && (
              <div style={shared.successBox}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>✅ Invoice Signed Successfully</div>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 8px", fontSize: 13 }}>
                  <span style={{ color: "#166534" }}>Token ID</span>     <strong>#{result.tokenId}</strong>
                  <span style={{ color: "#166534" }}>Transaction</span>  <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{result.txHash}</span>
                  <span style={{ color: "#166534" }}>Gas Used</span>     <span>{result.gasUsed}</span>
                  <span style={{ color: "#166534" }}>Status</span>       <span>Approved — ready for marketplace</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div style={shared.card}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 14 }}>About Signing</h3>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 14 }}>
            When you sign an invoice, you confirm that you have received the goods or services
            and agree to pay the invoice amount to the NFT holder on the due date.
          </p>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 14 }}>
            Your signature is recorded permanently on the Ethereum blockchain, giving the
            invoice NFT its intrinsic value and making it eligible for trading.
          </p>
          <div style={{ padding: "12px 14px", background: "#eff6ff", borderRadius: 8, fontSize: 13, color: "#1e40af" }}>
            <strong>Security:</strong> Only the buyer address specified by the supplier during invoice creation can sign. Any other address will be rejected.
          </div>
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#fffbeb", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
            <strong>Gas fee:</strong> Approx. 0.000139 ETH (~$0.32) for signing.
          </div>
        </div>
      </div>
    </div>
  );
}
