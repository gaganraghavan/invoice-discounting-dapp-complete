import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { shared, colors } from "../styles";

function Badge({ label, color }) {
  const map = {
    green:  { bg: "#dcfce7", color: "#15803d" },
    yellow: { bg: "#fef9c3", color: "#854d0e" },
    blue:   { bg: "#dbeafe", color: "#1e40af" },
    gray:   { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[color] || map.gray;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

function ListingCard({ listing, onBuy, buying, buyRole }) {
  const [expanded, setExpanded] = useState(false);
  const discount = listing.invoiceAmount > 0
    ? (((listing.invoiceAmount - listing.currPrice) / listing.invoiceAmount) * 100).toFixed(1)
    : 0;

  return (
    <div style={{ ...shared.card, marginBottom: 12, cursor: "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Invoice #{listing.tokenId}</span>
            <Badge label="For Sale" color="yellow" />
            {listing.isApproved && <Badge label="Buyer Signed" color="green" />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px 24px", fontSize: 13, marginBottom: 12 }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>INVOICE VALUE</div>
              <div style={{ fontWeight: 600 }}>{listing.invoiceAmount} ETH</div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>CURRENT PRICE</div>
              <div style={{ fontWeight: 700, color: "#2563eb", fontSize: 16 }}>{listing.currPrice} ETH</div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>DUE DATE</div>
              <div style={{ fontWeight: 600 }}>{listing.dueDate}</div>
            </div>
          </div>
          {discount > 0 && (
            <div style={{ display: "inline-block", padding: "3px 10px", background: "#dcfce7", borderRadius: 6, fontSize: 12, color: "#15803d", fontWeight: 600, marginBottom: 8 }}>
              💰 {discount}% discount — potential profit opportunity
            </div>
          )}
        </div>
        <div style={{ marginLeft: 20, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <button onClick={() => onBuy(listing.tokenId)} disabled={buying === listing.tokenId}
            style={{ ...shared.btn("primary"), opacity: buying === listing.tokenId ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {buying === listing.tokenId ? "Processing..." : `Buy for ${listing.currPrice} ETH`}
          </button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ ...shared.btn("outline"), fontSize: 12, padding: "6px 12px" }}>
            {expanded ? "Hide details" : "View details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginTop: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "6px 12px", fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>Supplier</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{listing.creator}</span>
            <span style={{ color: "#64748b" }}>Buyer</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{listing.buyer}</span>
            <span style={{ color: "#64748b" }}>Current Owner</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{listing.currentOwner}</span>
            {listing.ipfsUrl && (
              <>
                <span style={{ color: "#64748b" }}>Invoice PDF</span>
                <a href={listing.ipfsUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12 }}>
                  View on IPFS →
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Marketplace() {
  const [listings, setListings]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [buying, setBuying]         = useState(null);
  const [buyRole, setBuyRole]       = useState("financier");
  const [buyKey, setBuyKey]         = useState("");
  const [error, setError]           = useState(null);
  const [txResult, setTxResult]     = useState(null);
  const [showList, setShowList]     = useState(false);
  // List form
  const [listForm, setListForm]     = useState({ tokenId: "", newSellingPriceEth: "", callerType: "supplier", callerPrivateKey: "" });
  const [listResult, setListResult] = useState(null);
  const [listError, setListError]   = useState(null);
  const [listLoading, setListLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.getMarketplace(); setListings(data.listings || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async tokenId => {
    setBuying(tokenId); setTxResult(null); setError(null);
    try {
      const body = { callerType: buyRole };
      if (buyRole === "custom") body.callerPrivateKey = buyKey;
      const { data } = await api.buyInvoice(tokenId, body);
      setTxResult(data); load();
    } catch (err) { setError(err.message); }
    finally { setBuying(null); }
  };

  const handleList = async e => {
    e.preventDefault();
    setListLoading(true); setListError(null); setListResult(null);
    try {
      const body = { newSellingPriceEth: listForm.newSellingPriceEth, callerType: listForm.callerType };
      if (listForm.callerType === "custom") body.callerPrivateKey = listForm.callerPrivateKey;
      const { data } = await api.approveInvoiceSale(parseInt(listForm.tokenId), body);
      setListResult(data); load();
    } catch (err) { setListError(err.message); }
    finally { setListLoading(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Marketplace</h1>
          <p style={{ color: "#64748b", margin: 0 }}>Browse and purchase discounted invoice NFTs from suppliers.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowList(!showList)} style={shared.btn("outline")}>
            {showList ? "Hide" : "List an Invoice"}
          </button>
          <button onClick={load} style={shared.btn("outline")}>Refresh</button>
        </div>
      </div>

      {/* List for sale panel */}
      {showList && (
        <div style={{ ...shared.card, marginBottom: 24, borderLeft: "4px solid #d97706" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>List Invoice for Sale</h3>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            Set a discounted selling price for your signed invoice NFT to attract financiers.
          </p>
          <form onSubmit={handleList}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div style={shared.formRow}>
                <label style={shared.label}>Token ID</label>
                <input type="number" min="0" value={listForm.tokenId} required
                  onChange={e => setListForm({ ...listForm, tokenId: e.target.value })}
                  placeholder="e.g. 0" style={shared.input} />
              </div>
              <div style={shared.formRow}>
                <label style={shared.label}>Selling Price (ETH)</label>
                <input type="number" step="0.0001" min="0.0001" value={listForm.newSellingPriceEth} required
                  onChange={e => setListForm({ ...listForm, newSellingPriceEth: e.target.value })}
                  placeholder="Lower than invoice amount" style={shared.input} />
              </div>
              <div style={shared.formRow}>
                <label style={shared.label}>Acting As</label>
                <select value={listForm.callerType} onChange={e => setListForm({ ...listForm, callerType: e.target.value })} style={shared.select}>
                  <option value="supplier">Supplier</option>
                  <option value="buyer">Buyer</option>
                  <option value="financier">Financier</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            {listForm.callerType === "custom" && (
              <div style={{ ...shared.formRow, maxWidth: 400 }}>
                <label style={shared.label}>Private Key</label>
                <input type="password" value={listForm.callerPrivateKey}
                  onChange={e => setListForm({ ...listForm, callerPrivateKey: e.target.value })}
                  placeholder="0x..." style={shared.input} />
              </div>
            )}
            <button type="submit" disabled={listLoading} style={{ ...shared.btn("warning"), opacity: listLoading ? 0.6 : 1 }}>
              {listLoading ? "Listing..." : "List for Sale"}
            </button>
          </form>
          {listError  && <div style={shared.errorBox}>❌ {listError}</div>}
          {listResult && <div style={shared.successBox}>✅ Invoice #{listResult.tokenId} listed at {listResult.discountedPrice} ETH. Tx: {listResult.txHash?.slice(0,20)}...</div>}
        </div>
      )}

      {/* Buyer role */}
      <div style={{ ...shared.card, padding: "14px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Buying as:</span>
          <select value={buyRole} onChange={e => setBuyRole(e.target.value)} style={{ ...shared.select, width: "auto", minWidth: 220 }}>
            <option value="supplier">Supplier</option>
            <option value="buyer">Buyer</option>
            <option value="financier">Financier</option>
            <option value="custom">Custom (enter key)</option>
          </select>
          {buyRole === "custom" && (
            <input type="password" value={buyKey} onChange={e => setBuyKey(e.target.value)}
              placeholder="Private key 0x..." style={{ ...shared.input, width: 260 }} />
          )}
        </div>
      </div>

      {txResult && (
        <div style={shared.successBox}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>✅ Invoice Purchased Successfully</div>
          <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 8px" }}>
            <span>Token ID</span>   <strong>#{txResult.tokenId}</strong>
            <span>New Owner</span>  <span style={{ fontFamily: "monospace", fontSize: 11 }}>{txResult.newOwner}</span>
            <span>Paid</span>       <span>{txResult.paidEth} ETH</span>
            <span>Transaction</span><span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{txResult.txHash}</span>
          </div>
        </div>
      )}

      {error && <div style={shared.errorBox}>❌ {error}</div>}

      {/* Listings */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 14 }}>
          {loading ? "Loading..." : `${listings.length} invoice${listings.length !== 1 ? "s" : ""} available`}
        </div>

        {!loading && listings.length === 0 && (
          <div style={{ ...shared.card, textAlign: "center", padding: 48, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No invoices listed</div>
            <div style={{ fontSize: 13 }}>Suppliers need to create, get signed, then list their invoices here.</div>
          </div>
        )}

        {listings.map(l => (
          <ListingCard key={l.tokenId} listing={l} onBuy={handleBuy} buying={buying} buyRole={buyRole} />
        ))}
      </div>
    </div>
  );
}
