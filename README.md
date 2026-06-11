# Invoice Discounting DApp — NFT-Based Approach

**Based on:** "A Non-Fungible Token Based Approach to Invoice Discounting"  
**Authors:** Shruti Jadon, Shashank R, Haria Mehkhad, Vinay Kumar S, Aishwarya N, Prasad B Honnavalli  
**Institution:** PES University — Published in IEEE

---

## Architecture

```
smart-contract/          ERC-721 Solidity contract (Hardhat + OpenZeppelin)
backend/                 Node.js + Express.js API (Ethers.js + web3.storage)
frontend/                React.js UI (Vite)
```

**No database** — blockchain + IPFS is the only storage (paper design).

---

## Three Parties (Table 1 of paper)

| Party | Role | Key Algorithms |
|-------|------|----------------|
| Supplier | Mints invoice NFT, lists for sale | Algorithm 1, 3, 4 |
| Buyer | Signs invoice, settles on due date | Algorithm 2, 9 |
| Financier | Buys discounted invoice NFT | Algorithm 5 |

All three use the **same interface** (Unified Interface System, Section IV-A).

---

## Ownership Journey

```
mintInvoice()        → Owner = Supplier   (isApproved=false, forSale=false)
signInvoice()        → Owner = Supplier   (isApproved=true)
approveInvoiceSale() → Owner = Supplier   (forSale=true, currPrice=discounted)
buyInvoice()         → Owner = FINANCIER  (ETH → Supplier)       ← 1st transfer
settleInvoice()      → Owner = BUYER      (ETH → Financier)      ← 2nd transfer
burnInvoiceNFT()     → Burned             (optional, buyer choice)
```

---

## Profit Formula — Equation 1

```
Profit = (I × R × T) / (100 × 365) − G

I = Invoice Amount (ETH)
R = Discount Rate (%)
T = Days until due date
G = Gas fees paid by financier

Paper gas reference (Table 2 at ETH=$2279.23):
  Financier pays: approveInvoiceSale ($0.23) + buyInvoice ($0.37) = $0.60 total
```

---

## Setup Instructions

### Prerequisites
- Node.js >= 18
- Ganache GUI (https://trufflesuite.com/ganache/) — install and open
- web3.storage free account (https://web3.storage) — get API token

---

### Step 1 — Smart Contract

```bash
cd smart-contract
npm install

# Copy and fill in .env
cp .env.example .env
# Fill in: SUPPLIER_PRIVATE_KEY, BUYER_PRIVATE_KEY, FINANCIER_PRIVATE_KEY
# (copy from Ganache GUI → Accounts tab → click key icon)

# Compile
npx hardhat compile

# Run tests (all algorithms)
npx hardhat test

# Deploy to Ganache
npx hardhat run scripts/deploy.js --network ganache
# This prints the contract address AND saves ABI to backend/src/contracts/ automatically
```

---

### Step 2 — Backend

```bash
cd backend
npm install

# Copy and fill in .env
cp .env.example .env
# Fill in:
#   CONTRACT_ADDRESS   — printed during deployment (or from backend/src/contracts/contractAddress.json)
#   SUPPLIER_PRIVATE_KEY, BUYER_PRIVATE_KEY, FINANCIER_PRIVATE_KEY  — same as smart-contract/.env
#   WEB3_STORAGE_TOKEN — from https://web3.storage dashboard
#   NETWORK=ganache

npm run dev
# Server starts at http://localhost:5000
# Check: http://localhost:5000/health
```

---

### Step 3 — Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## Testing with Postman (Section VI of paper)

Import these requests into Postman:

### 1. Mint Invoice (Algorithm 1)
```
POST http://localhost:5000/api/invoices/mint
Content-Type: multipart/form-data

invoicePDF:       [attach any PDF file]
buyerAddress:     [Ganache account 2 address]
invoiceAmountEth: 1.0
dueDate:          2025-12-31
callerType:       supplier
```

### 2. Sign Invoice (Algorithm 2)
```
POST http://localhost:5000/api/invoices/0/sign
Content-Type: application/json

{ "callerType": "buyer" }
```

### 3. List for Sale (Algorithm 3)
```
POST http://localhost:5000/api/invoices/0/approve-sale
Content-Type: application/json

{ "newSellingPriceEth": "0.8", "callerType": "supplier" }
```

### 4. Browse Marketplace
```
GET http://localhost:5000/api/marketplace
```

### 5. Buy Invoice (Algorithm 5)
```
POST http://localhost:5000/api/invoices/0/buy
Content-Type: application/json

{ "callerType": "financier" }
```

### 6. Settle Invoice (Algorithm 9)
```
POST http://localhost:5000/api/invoices/0/settle
Content-Type: application/json

{ "callerType": "buyer" }
```

### 7. Profit Calculator (Equation 1)
```
POST http://localhost:5000/api/invoices/profit-calculator
Content-Type: application/json

{
  "invoiceAmountEth": "1.0",
  "discountRatePercent": "5",
  "daysUntilDue": "30",
  "gasFeesEth": "0.000263"
}
```

### 8. Get Metadata (Figure 9/11/14 equivalent)
```
GET http://localhost:5000/api/invoices/0
```

---

## Deploy to Sepolia (as in the paper)

```bash
cd smart-contract

# Fill SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in .env
# Get free Sepolia ETH: https://sepoliafaucet.com

npx hardhat run scripts/deploy.js --network sepolia

# Verify on Etherscan (seniors did this — Section VI-A)
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```

---

## Gas Fees Reference (Table 2 — at ETH=$2279.23)

| Function | Caller | ETH | USD |
|----------|--------|-----|-----|
| mintInvoice | Seller | 0.002129 | $4.55 |
| signInvoice | Buyer | 0.000139 | $0.32 |
| approveInvoiceSale | Seller/Financier | 0.000102 | $0.23 |
| buyInvoice | Financier/Buyer | 0.000161 | $0.37 |
| revokeInvoiceSale | Owner | 0.000102 | $0.21 |
| **Total per cycle** | | | **$6.07** |

---

## File Structure

```
invoice-dapp/
├── smart-contract/
│   ├── contracts/InvoiceNFT.sol        ← ERC-721 contract (Algorithms 1-5 + 9)
│   ├── scripts/deploy.js               ← Deployment script
│   ├── test/InvoiceNFT.test.js         ← All algorithm tests
│   ├── hardhat.config.js               ← Ganache + Sepolia config
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── app.js                      ← Express server entry point
│   │   ├── config/blockchain.js        ← Ethers.js provider + signer
│   │   ├── services/
│   │   │   ├── contractService.js      ← All 7 contract functions + Eq.1
│   │   │   └── ipfsService.js          ← web3.storage IPFS integration
│   │   ├── routes/
│   │   │   ├── invoiceRoutes.js        ← /api/invoices/* endpoints
│   │   │   └── marketplaceRoutes.js    ← /api/marketplace/* endpoints
│   │   ├── middleware/errorHandler.js
│   │   └── contracts/                  ← Auto-generated by deploy.js
│   │       ├── InvoiceNFT.json
│   │       └── contractAddress.json
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.jsx                     ← Unified Interface System
    │   ├── styles.js                   ← Shared design tokens
    │   ├── services/api.js             ← All API calls
    │   └── components/
    │       ├── MintInvoice.jsx         ← Algorithm 1
    │       ├── SignInvoice.jsx         ← Algorithm 2
    │       ├── Marketplace.jsx         ← Algorithms 3-5
    │       └── MyInvoices.jsx          ← Algorithm 9 + Profit Calculator
    └── package.json
```
