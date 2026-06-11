/**
 * MintInvoice.jsx — Algorithm 1: mintInvoice
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section IV-B-1:
 *   Supplier uploads invoice PDF → backend uploads to IPFS → mints ERC-721 NFT.
 *   CID stored in contract as tokenURI.
 *   isApproved=false, forSale=false after minting.
 *   Prevents duplicate CID (double-spend prevention) and supplier==buyer (fake invoice).
 *
 * Postman equivalent: Figure 7 (success) and Figure 8 (duplicate rejection).
 */

import { useState } from "react";
import { api }      from "../services/api";
import { shared, colors, callerTypeOptions } from "../styles";

// Reusable caller type selector component
function CallerSelector({ callerType, onChange, privateKey, onPrivateKeyChange }) {
  return (
    <>
      <div style={shared.formRow}>
        <label style={shared.label}>Caller Role</label>
        <select
          value={callerType}
          onChange={(e) => onChange(e.target.value)}
          style={shared.select}
        >
          {callerTypeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: colors.textMuted }}>
          Paper Table 1: each stakeholder has a unique Ethereum address
        </span>
      </div>

      {callerType === "custom" && (
        <div style={shared.formRow}>
          <label style={shared.label}>Private Key</label>
          <input
            type="password"
            value={privateKey}
            onChange={(e) => onPrivateKeyChange(e.target.value)}
            placeholder="0x..."
            style={shared.input}
          />
        </div>
      )}
    </>
  );
}

export default function MintInvoice() {
  const [form, setForm] = useState({
    buyerAddress:     "",
    invoiceAmountEth: "",
    dueDate:          "",
    callerType:       "supplier",
    callerPrivateKey: "",
  });
  const [file,    setFile]    = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("invoicePDF", file);
      fd.append("buyerAddress",     form.buyerAddress);
      fd.append("invoiceAmountEth", form.invoiceAmountEth);
      fd.append("dueDate",          form.dueDate);
      fd.append("callerType",       form.callerType);
      if (form.callerType === "custom" && form.callerPrivateKey) {
        fd.append("callerPrivateKey", form.callerPrivateKey);
      }

      const { data } = await api.mintInvoice(fd);
      setResult(data);
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
          Mint Invoice NFT
        </h2>
        <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
          <strong style={{ color: colors.blue }}>Algorithm 1</strong> — Section IV-B-1 of the paper.
          Supplier uploads invoice PDF to IPFS, mints ERC-721 NFT on Ethereum.
          Duplicate invoices are rejected (double-spend prevention).
        </p>
      </div>

      {/* Info box */}
      <div style={{
        background: "#1c2e4a", border: `1px solid ${colors.blue}`,
        borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 13,
        color: "#79c0ff",
      }}>
        📋 After minting: <strong>isApproved=false, forSale=false, Owner=Supplier</strong>.
        Send the TokenID to the Buyer so they can sign it (Algorithm 2).
      </div>

      <form onSubmit={submit}>
        {/* PDF Upload */}
        <div style={shared.formRow}>
          <label style={shared.label}>Invoice PDF Document</label>
          <input
            type="file"
            accept=".pdf"
            required
            onChange={(e) => setFile(e.target.files[0])}
            style={{ ...shared.input, padding: "7px 12px", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            PDF is uploaded to IPFS — the CID (unique hash) is stored in the NFT
          </span>
        </div>

        {/* Buyer Address */}
        <div style={shared.formRow}>
          <label style={shared.label}>Buyer Ethereum Address</label>
          <input
            name="buyerAddress"
            value={form.buyerAddress}
            onChange={handle}
            placeholder="0x1063009b9fb.....8aD75Be00"
            required
            style={shared.input}
          />
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            Must differ from supplier address (fake invoice prevention — Algorithm 1)
          </span>
        </div>

        {/* Invoice Amount */}
        <div style={shared.formRow}>
          <label style={shared.label}>Invoice Amount (ETH)</label>
          <input
            name="invoiceAmountEth"
            type="number"
            step="0.0001"
            min="0.0001"
            value={form.invoiceAmountEth}
            onChange={handle}
            placeholder="1.0"
            required
            style={shared.input}
          />
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            Full invoice value — buyer pays this to financier on due date (settleInvoice)
          </span>
        </div>

        {/* Due Date */}
        <div style={shared.formRow}>
          <label style={shared.label}>Due Date</label>
          <input
            name="dueDate"
            type="date"
            value={form.dueDate}
            onChange={handle}
            required
            style={shared.input}
          />
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            Paper Table 2 example: 10-04-2024. Used in Equation 1 profit formula.
          </span>
        </div>

        {/* Caller */}
        <CallerSelector
          callerType={form.callerType}
          onChange={(v) => setForm({ ...form, callerType: v })}
          privateKey={form.callerPrivateKey}
          onPrivateKeyChange={(v) => setForm({ ...form, callerPrivateKey: v })}
        />

        <button
          type="submit"
          disabled={loading || !file}
          style={{
            ...shared.btn("primary"),
            opacity: loading || !file ? 0.6 : 1,
            width: "100%",
            padding: "11px",
            fontSize: 15,
          }}
        >
          {loading ? "⏳ Uploading to IPFS & Minting NFT..." : "🪙 Mint Invoice NFT"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div style={shared.errorBox}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Success — matches paper Figure 7 / Figure 9 output */}
      {result && (
        <div style={shared.successBox}>
          <div style={{ marginBottom: 8, fontSize: 14, fontFamily: "sans-serif", fontWeight: 600, color: colors.greenLight }}>
            ✅ Invoice NFT Minted Successfully
          </div>
          <div>Token ID:      <strong style={{ color: "#ffa657" }}>#{result.tokenId}</strong></div>
          <div>Tx Hash:       {result.txHash}</div>
          <div>IPFS CID:      {result.ipfsCID}</div>
          <div>Block:         {result.blockNumber}</div>
          <div>Gas Used:      {result.gasUsed}</div>
          <div>isApproved:    false (buyer must sign — Algorithm 2)</div>
          <div>forSale:       false</div>
          <div>Ownership:     Supplier</div>
          <div style={{ marginTop: 8 }}>
            <a
              href={result.ipfsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#79c0ff" }}
            >
              📄 View Invoice PDF on IPFS
            </a>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
            Next step: Go to &quot;Sign Invoice&quot; tab and use Token ID #{result.tokenId}
          </div>
        </div>
      )}
    </div>
  );
}
