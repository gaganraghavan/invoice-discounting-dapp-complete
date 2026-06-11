/**
 * styles.js — Shared design tokens and style constants
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Unified Interface System (Section IV-A): all three parties use same dashboard.
 * Dark theme consistent with blockchain/finance DApp aesthetic.
 */

// ─── Color Palette ────────────────────────────────────────────────────────────
export const colors = {
  bg:           "#0d1117",
  bgCard:       "#161b22",
  bgInput:      "#1c2128",
  bgHover:      "#21262d",
  border:       "#30363d",
  borderLight:  "#3d444d",

  textPrimary:  "#e6edf3",
  textSecondary:"#8b949e",
  textMuted:    "#656d76",

  blue:         "#1f6feb",
  blueHover:    "#388bfd",
  green:        "#238636",
  greenLight:   "#3fb950",
  red:          "#da3633",
  redLight:     "#f85149",
  yellow:       "#9e6a03",
  yellowLight:  "#d29922",
  purple:       "#8957e5",
  orange:       "#f0883e",
};

// ─── Role colors (Supplier / Buyer / Financier) ───────────────────────────────
export const roleColors = {
  supplier:  { bg: "#1c2e4a", border: "#1f6feb", text: "#79c0ff", label: "Supplier" },
  buyer:     { bg: "#1c3a2a", border: "#238636", text: "#56d364", label: "Buyer"    },
  financier: { bg: "#2d1f54", border: "#8957e5", text: "#bc8cff", label: "Financier"},
};

// ─── Stage badge styles (ownership journey from paper) ────────────────────────
export const stageBadge = {
  MINTED_UNSIGNED:         { bg: "#21262d", color: "#8b949e",  label: "Minted — Unsigned"    },
  SIGNED_NOT_LISTED:       { bg: "#1c2e4a", color: "#79c0ff",  label: "Signed — Not Listed"  },
  LISTED_FOR_SALE:         { bg: "#2d2a1f", color: "#d29922",  label: "Listed for Sale"       },
  PURCHASED_BY_FINANCIER:  { bg: "#2d1f54", color: "#bc8cff",  label: "Owned by Financier"   },
  SETTLED_OWNED_BY_BUYER:  { bg: "#1c3a2a", color: "#56d364",  label: "Settled — Buyer Owns" },
  BURNED:                  { bg: "#3a1c1c", color: "#f85149",  label: "Burned"                },
  UNKNOWN:                 { bg: "#21262d", color: "#8b949e",  label: "Unknown"               },
};

// ─── Shared component styles ──────────────────────────────────────────────────
export const shared = {
  card: {
    background:   colors.bgCard,
    border:       `1px solid ${colors.border}`,
    borderRadius: 8,
    padding:      24,
    marginBottom: 20,
  },
  input: {
    width:        "100%",
    padding:      "9px 12px",
    fontSize:     14,
    borderRadius: 6,
    border:       `1px solid ${colors.border}`,
    background:   colors.bgInput,
    color:        colors.textPrimary,
    outline:      "none",
    boxSizing:    "border-box",
  },
  label: {
    display:      "block",
    fontSize:     13,
    fontWeight:   600,
    color:        colors.textSecondary,
    marginBottom: 6,
    textTransform:"uppercase",
    letterSpacing:"0.5px",
  },
  btn: (variant = "primary") => ({
    padding:       "9px 18px",
    fontSize:      14,
    fontWeight:    600,
    borderRadius:  6,
    border:        "none",
    cursor:        "pointer",
    transition:    "background 0.15s",
    background: variant === "primary"  ? colors.blue
              : variant === "success"  ? colors.green
              : variant === "danger"   ? colors.red
              : variant === "warning"  ? colors.yellow
              : colors.bgHover,
    color: "#ffffff",
  }),
  select: {
    width:        "100%",
    padding:      "9px 12px",
    fontSize:     14,
    borderRadius: 6,
    border:       `1px solid ${colors.border}`,
    background:   colors.bgInput,
    color:        colors.textPrimary,
    outline:      "none",
    cursor:       "pointer",
  },
  formRow: {
    display:      "flex",
    flexDirection:"column",
    gap:          6,
    marginBottom: 16,
  },
  errorBox: {
    background:   "#3a1c1c",
    border:       `1px solid ${colors.red}`,
    borderRadius: 6,
    padding:      "10px 14px",
    color:        colors.redLight,
    fontSize:     13,
    marginTop:    12,
  },
  successBox: {
    background:   "#1c3a2a",
    border:       `1px solid ${colors.green}`,
    borderRadius: 6,
    padding:      14,
    color:        colors.greenLight,
    fontSize:     13,
    fontFamily:   "monospace",
    marginTop:    12,
    wordBreak:    "break-all",
  },
};

// ─── Caller type selector options ─────────────────────────────────────────────
// Paper Section IV-A: Unified Interface — same interface for all three roles
export const callerTypeOptions = [
  { value: "supplier",  label: "Supplier  (uses SUPPLIER_PRIVATE_KEY from .env)"  },
  { value: "buyer",     label: "Buyer     (uses BUYER_PRIVATE_KEY from .env)"     },
  { value: "financier", label: "Financier (uses FINANCIER_PRIVATE_KEY from .env)" },
  { value: "custom",    label: "Custom    (enter private key below)"              },
];
