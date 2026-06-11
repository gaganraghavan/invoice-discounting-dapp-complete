/**
 * api.js — Frontend API service layer
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * All API calls go to the Node.js + Express.js backend (Section V).
 * The backend then communicates with the Ethereum blockchain via Ethers.js.
 *
 * Unified Interface System (Section IV-A):
 *   All three parties (Supplier, Buyer, Financier) use the same dashboard.
 *   Roles are interchangeable — same wallet can act as any party.
 */

import axios from "axios";

// Base URL — backend runs on port 5000 by default
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,  // 2 minutes — blockchain transactions can take time
  headers: { "Content-Type": "application/json" },
});

// ─── Response interceptor: unwrap error messages ─────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Network error";
    return Promise.reject(new Error(message));
  }
);

// ─── Invoice API ─────────────────────────────────────────────────────────────

export const api = {

  /**
   * Algorithm 1: mintInvoice
   * Supplier uploads PDF → backend uploads to IPFS → mints NFT on blockchain
   * @param {FormData} formData — includes invoicePDF file + metadata
   */
  mintInvoice: (formData) =>
    apiClient.post("/api/invoices/mint", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  /**
   * Algorithm 2: signInvoice
   * Buyer signs the invoice NFT — sets isApproved=true
   */
  signInvoice: (tokenId, body) =>
    apiClient.post(`/api/invoices/${tokenId}/sign`, body),

  /**
   * Algorithm 3: approveInvoiceSale
   * Supplier lists invoice for sale at discounted price
   */
  approveInvoiceSale: (tokenId, body) =>
    apiClient.post(`/api/invoices/${tokenId}/approve-sale`, body),

  /**
   * Algorithm 4: revokeInvoiceSale
   * NFT owner pulls invoice off marketplace
   */
  revokeInvoiceSale: (tokenId, body) =>
    apiClient.post(`/api/invoices/${tokenId}/revoke-sale`, body),

  /**
   * Algorithm 5: buyInvoice
   * Financier buys the invoice NFT — ETH transferred to Supplier
   */
  buyInvoice: (tokenId, body) =>
    apiClient.post(`/api/invoices/${tokenId}/buy`, body),

  /**
   * Dissertation Algorithm 9: settleInvoice
   * Buyer pays full invoice amount to Financier on due date
   */
  settleInvoice: (tokenId, body) =>
    apiClient.post(`/api/invoices/${tokenId}/settle`, body),

  /**
   * burnInvoiceNFT — optional, buyer's choice (dissertation)
   */
  burnInvoiceNFT: (tokenId, body) =>
    apiClient.post(`/api/invoices/${tokenId}/burn`, body),

  /**
   * Get invoice metadata from blockchain (Figure 5 struct)
   */
  getInvoiceMetadata: (tokenId) =>
    apiClient.get(`/api/invoices/${tokenId}`),

  /**
   * Profit calculator — Equation 1: Profit = (I×R×T)/(100×365) - G
   */
  calculateProfit: (body) =>
    apiClient.post("/api/invoices/profit-calculator", body),

  // ─── Marketplace ────────────────────────────────────────────────────────────

  /**
   * Get all invoices currently forSale=true (financier marketplace view)
   */
  getMarketplace: () =>
    apiClient.get("/api/marketplace"),

  /**
   * Get all minted invoices — full blockchain history / audit trail
   */
  getAllInvoices: () =>
    apiClient.get("/api/marketplace/all"),

  /**
   * Get single listing detail
   */
  getListingDetail: (tokenId) =>
    apiClient.get(`/api/marketplace/${tokenId}`),

  /**
   * Server health check — blockchain connection status
   */
  healthCheck: () =>
    apiClient.get("/health"),
};

export default api;
