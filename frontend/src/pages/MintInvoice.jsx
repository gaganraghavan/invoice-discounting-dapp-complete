import { useState } from "react";
import { api } from "../services/api";
import { shared, colors } from "../styles";

export default function MintInvoice() {
  const [form, setForm] = useState({
    buyerAddress: "", invoiceAmountEth: "", dueDate: "", callerType: "supplier", callerPrivateKey: "",
  });
  const [file, setFile]       = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("invoicePDF", file);
      fd.append("buyerAddress",     form.buyerAddress);
      fd.append("invoiceAmountEth", form.invoiceAmountEth);
      fd.append("dueDate",          form.dueDate);
      fd.append("callerType",       form.callerType);
      if (form.callerType === "custom") fd.append("callerPrivateKey", form.callerPrivateKey);
      const { data } = await api.mintInvoice(fd);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Create Invoice</h1>
        <p style={{ color: "#64748b", margin: 0 }}>Upload your invoice PDF and mint it as an NFT on the Ethereum blockchain.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        {/* Form */}
        <div style={shared.card}>
          <form onSubmit={submit}>
            <div style={shared.formRow}>
              <label style={shared.label}>Invoice PDF Document *</label>
              <input type="file" accept=".pdf" required onChange={e => setFile(e.target.files[0])}
                style={{ ...shared.input, padding: "8px 14px", cursor: "pointer" }} />
              <span style={{ fontSize: 12, color: colors.textMuted }}>
                The PDF will be stored on IPFS. The unique file hash prevents duplicate submissions.
              </span>
            </div>

            <div style={shared.formRow}>
              <label style={shared.label}>Buyer's Ethereum Address *</label>
              <input name="buyerAddress" value={form.buyerAddress} onChange={handle} required
                placeholder="0x1063009b9fb...8aD75Be00" style={shared.input} />
              <span style={{ fontSize: 12, color: colors.textMuted }}>Must be different from your own address.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={shared.formRow}>
                <label style={shared.label}>Invoice Amount (ETH) *</label>
                <input name="invoiceAmountEth" type="number" step="0.0001" min="0.0001"
                  value={form.invoiceAmountEth} onChange={handle} required placeholder="1.0" style={shared.input} />
              </div>
              <div style={shared.formRow}>
                <label style={shared.label}>Due Date *</label>
                <input name="dueDate" type="date" value={form.dueDate} onChange={handle} required style={shared.input} />
              </div>
            </div>

            <div style={shared.formRow}>
              <label style={shared.label}>Acting As</label>
              <select name="callerType" value={form.callerType} onChange={handle} style={shared.select}>
                <option value="supplier">Supplier (uses SUPPLIER_PRIVATE_KEY from .env)</option>
                <option value="buyer">Buyer (uses BUYER_PRIVATE_KEY from .env)</option>
                <option value="financier">Financier (uses FINANCIER_PRIVATE_KEY from .env)</option>
                <option value="custom">Custom (enter private key below)</option>
              </select>
            </div>

            {form.callerType === "custom" && (
              <div style={shared.formRow}>
                <label style={shared.label}>Private Key</label>
                <input name="callerPrivateKey" type="password" value={form.callerPrivateKey}
                  onChange={handle} placeholder="0x..." style={shared.input} />
              </div>
            )}

            <button type="submit" disabled={loading || !file}
              style={{ ...shared.btn("primary"), width: "100%", padding: 12, fontSize: 15, opacity: loading || !file ? 0.6 : 1 }}>
              {loading ? "Uploading to IPFS and minting NFT..." : "Create Invoice NFT"}
            </button>
          </form>

          {error  && <div style={shared.errorBox}>❌ {error}</div>}
          {result && (
            <div style={shared.successBox}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>✅ Invoice NFT Created Successfully</div>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 8px", fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>Token ID</span>     <strong>#{result.tokenId}</strong>
                <span style={{ color: "#64748b" }}>Transaction</span>  <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{result.txHash}</span>
                <span style={{ color: "#64748b" }}>IPFS CID</span>     <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{result.ipfsCID}</span>
                <span style={{ color: "#64748b" }}>Block</span>        <span>#{result.blockNumber}</span>
                <span style={{ color: "#64748b" }}>Gas Used</span>     <span>{result.gasUsed}</span>
                <span style={{ color: "#64748b" }}>Status</span>       <span>Pending buyer signature</span>
              </div>
              {result.ipfsUrl && (
                <a href={result.ipfsUrl} target="_blank" rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 10, color: "#2563eb", fontSize: 13 }}>
                  📄 View Invoice on IPFS →
                </a>
              )}
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#dbeafe", borderRadius: 6, fontSize: 12, color: "#1e40af" }}>
                Share Token ID <strong>#{result.tokenId}</strong> with the buyer so they can sign it.
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div>
          <div style={shared.card}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 14, marginTop: 0 }}>What happens next?</h3>
            {[
              { n: 1, t: "NFT minted",       d: "Your invoice is stored on IPFS and minted as an ERC-721 NFT on Ethereum." },
              { n: 2, t: "Buyer signs",       d: "The buyer signs the invoice, giving it intrinsic value equal to the invoice amount." },
              { n: 3, t: "List for sale",     d: "You set a discounted price and list the signed invoice on the marketplace." },
              { n: 4, t: "Financier buys",    d: "A financier buys the NFT and you instantly receive the discounted ETH." },
              { n: 5, t: "Settlement",        d: "On the due date, the buyer pays the full amount to the financier." },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#eff6ff", border: "1px solid #bfdbfe",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                  {s.n}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...shared.card, background: "#fffbeb", border: "1px solid #fde68a" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>💡 Gas Fee Reference</div>
            <div style={{ fontSize: 12, color: "#78350f" }}>
              Creating an invoice NFT costs approx. <strong>0.002129 ETH (~$4.55)</strong> in gas fees at ETH = $2279.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
