/**
 * generateInvoices.js
 * Generates realistic invoice PDFs for testing the InvoiceNFT DApp.
 * Usage:
 *   node generateInvoices.js              -- generates 5 invoices
 *   node generateInvoices.js --count 10   -- generates 10 invoices
 * Output: ./generated-invoices/ folder with PDFs + invoices.json index
 */
const fs   = require("fs");
const path = require("path");

const args  = process.argv.slice(2);
const idx   = args.indexOf("--count");
const COUNT = idx !== -1 ? (parseInt(args[idx + 1]) || 5) : 5;
const OUT   = path.join(__dirname, "generated-invoices");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const SUPPLIERS = [
  { name: "TechSupplies Pvt Ltd",      gstin: "29AABCT1332L1Z5", city: "Bengaluru", phone: "+91-9876543210", email: "accounts@techsupplies.in" },
  { name: "Global Traders Co",          gstin: "27AAACG2115R1Z3", city: "Mumbai",    phone: "+91-9988776655", email: "finance@globaltraders.co" },
  { name: "SmartManufacturing Ltd",     gstin: "07AABCS1429B1Z6", city: "Delhi",     phone: "+91-9123456789", email: "billing@smartmfg.com"      },
  { name: "Horizon Exports Pvt Ltd",    gstin: "33AABCH3221K1Z9", city: "Chennai",   phone: "+91-9345678901", email: "export@horizon.in"         },
  { name: "NextGen Electronics Ltd",    gstin: "19AABCN5543N1Z8", city: "Kolkata",   phone: "+91-9654321098", email: "sales@nextgenelec.com"     },
];

const BUYERS = [
  { name: "Infosys Limited",            gstin: "29AABCI1682H1Z1", city: "Bengaluru", phone: "+91-8023456789", email: "payments@infosys.com"   },
  { name: "Tata Consultancy Services",  gstin: "27AAACT1155F1ZV", city: "Mumbai",    phone: "+91-8067891234", email: "ap@tcs.com"             },
  { name: "Wipro Technologies Ltd",     gstin: "29AAACW0466N1Z0", city: "Bengaluru", phone: "+91-8043210987", email: "finance@wipro.com"      },
  { name: "HCL Technologies Ltd",       gstin: "09AAACH8007N1Z1", city: "Noida",     phone: "+91-8098765432", email: "accounts@hcl.com"       },
  { name: "Mahindra & Mahindra Ltd",    gstin: "27AAACM3025E1ZP", city: "Pune",      phone: "+91-8056789012", email: "vendor@mahindra.com"    },
];

const PRODUCTS = [
  { name: "Industrial Microcontrollers (Arduino Mega)",    unit: "Units",  rate: 2500  },
  { name: "Server RAM DDR5 32GB",                          unit: "Units",  rate: 8500  },
  { name: "Precision Machined Aluminum Components",        unit: "Pieces", rate: 1200  },
  { name: "Enterprise SSD 2TB NVMe",                      unit: "Units",  rate: 15000 },
  { name: "IoT Sensor Modules",                            unit: "Units",  rate: 3500  },
  { name: "48-Port Ethernet Switch",                       unit: "Units",  rate: 45000 },
  { name: "Solar Panel 400W Monocrystalline",              unit: "Units",  rate: 12000 },
  { name: "Hydraulic Pump Assembly",                       unit: "Units",  rate: 35000 },
  { name: "Industrial Copper Wire 100m",                   unit: "Rolls",  rate: 1800  },
  { name: "HPLC Grade Reagent Chemicals",                  unit: "Litres", rate: 5200  },
];

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank"];
const IFSC  = ["HDFC0001234", "ICIC0005678", "SBIN0009012", "UTIB0003456", "KKBK0007890"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randStr(len) { return Math.random().toString(36).substring(2, 2 + len).toUpperCase(); }
function fmtINR(n) { return "Rs." + n.toLocaleString("en-IN"); }
function addDays(d) {
  const dt = new Date(); dt.setDate(dt.getDate() + d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function toETH(inr) { return (inr * 0.0000035).toFixed(6); }

function buildInvoice(i) {
  let sup = pick(SUPPLIERS), buy = pick(BUYERS);
  while (buy.name === sup.name) buy = pick(BUYERS);
  const numItems = randInt(1, 4);
  const items = [];
  let subtotal = 0;
  for (let k = 0; k < numItems; k++) {
    const p = pick(PRODUCTS), qty = randInt(2, 30), amt = qty * p.rate;
    items.push({ ...p, qty, amt }); subtotal += amt;
  }
  const gst = Math.round(subtotal * 0.18), total = subtotal + gst;
  const days = pick([30, 45, 60, 90]);
  const invNo = `INV-${new Date().getFullYear()}-${String(i + 1).padStart(3, "0")}-${randStr(4)}`;
  const bankIdx = randInt(0, BANKS.length - 1);
  return {
    invNo, date: new Date().toLocaleDateString("en-IN"),
    dueDate: addDays(days), days,
    sup: { ...sup, addr: `${randInt(1,999)}, Industrial Area Phase ${randInt(1,4)}`, pin: String(randInt(500000, 599999)) },
    buy: { ...buy, addr: `${randInt(1,50)}, Tech Park, Sector ${randInt(1,25)}`,    pin: String(randInt(400000, 499999)) },
    items, subtotal, gst, total, totalETH: toETH(total),
    bank: BANKS[bankIdx], ifsc: IFSC[bankIdx],
    accNo: String(randInt(10000000000, 99999999999)),
    uniqueId: Date.now() + "_" + randStr(8),
  };
}

function makePDF(d) {
  // Build items section
  let itemLines = "";
  d.items.forEach((item, i) => {
    const y = 490 - i * 24;
    itemLines += `BT /F1 9 Tf 45 ${y} Td (${item.name.substring(0, 42)}) Tj ET\n`;
    itemLines += `BT /F1 9 Tf 360 ${y} Td (${item.qty} ${item.unit}) Tj ET\n`;
    itemLines += `BT /F1 9 Tf 420 ${y} Td (${fmtINR(item.rate)}) Tj ET\n`;
    itemLines += `BT /F1 9 Tf 495 ${y} Td (${fmtINR(item.amt)}) Tj ET\n`;
  });
  const totY = 490 - d.items.length * 24 - 20;

  const content =
`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length 4200 >>
stream
q 0.10 0.25 0.55 rg 0 800 595 42 re f Q
BT /F2 18 Tf 40 814 Td 1 1 1 rg (TAX INVOICE) Tj ET
BT /F1 9 Tf 380 820 Td 1 1 1 rg (NFT Invoice Discounting Platform) Tj ET
BT /F1 8 Tf 380 808 Td (Powered by Ethereum Blockchain and IPFS) Tj ET
q 0.94 0.96 1.00 rg 350 730 205 63 re f Q
q 0.10 0.25 0.55 rg 350 793 205 2 re f Q
BT /F2 10 Tf 358 774 Td 0.10 0.25 0.55 rg (Invoice Number:) Tj ET
BT /F1 10 Tf 358 760 Td 0 0 0 rg (${d.invNo}) Tj ET
BT /F1 9 Tf 358 746 Td (Date: ${d.date}) Tj ET
BT /F1 9 Tf 358 733 Td (Due: ${d.dueDate}  [Net ${d.days}]) Tj ET
BT /F2 9 Tf 40 720 Td 0.10 0.25 0.55 rg (SUPPLIER:) Tj ET
BT /F2 11 Tf 40 706 Td 0 0 0 rg (${d.sup.name}) Tj ET
BT /F1 8 Tf 40 693 Td (GSTIN: ${d.sup.gstin}) Tj ET
BT /F1 8 Tf 40 681 Td (${d.sup.addr}, ${d.sup.city} - ${d.sup.pin}) Tj ET
BT /F1 8 Tf 40 669 Td (${d.sup.phone}   ${d.sup.email}) Tj ET
BT /F2 9 Tf 310 720 Td 0.10 0.25 0.55 rg (BILL TO:) Tj ET
BT /F2 11 Tf 310 706 Td 0 0 0 rg (${d.buy.name}) Tj ET
BT /F1 8 Tf 310 693 Td (GSTIN: ${d.buy.gstin}) Tj ET
BT /F1 8 Tf 310 681 Td (${d.buy.addr}, ${d.buy.city} - ${d.buy.pin}) Tj ET
BT /F1 8 Tf 310 669 Td (${d.buy.phone}   ${d.buy.email}) Tj ET
q 0.15 0.20 0.40 rg 35 635 525 20 re f Q
BT /F2 9 Tf 45 641 Td 1 1 1 rg (DESCRIPTION) Tj ET
BT /F2 9 Tf 360 641 Td (QTY / UNIT) Tj ET
BT /F2 9 Tf 415 641 Td (RATE) Tj ET
BT /F2 9 Tf 490 641 Td (AMOUNT) Tj ET
0 0 0 rg
${itemLines}
q 0.90 0.90 0.90 rg 35 ${totY - 8} 525 1 re f Q
BT /F1 10 Tf 380 ${totY - 22} Td (Subtotal:) Tj ET
BT /F1 10 Tf 490 ${totY - 22} Td (${fmtINR(d.subtotal)}) Tj ET
BT /F1 10 Tf 380 ${totY - 38} Td (GST @ 18%:) Tj ET
BT /F1 10 Tf 490 ${totY - 38} Td (${fmtINR(d.gst)}) Tj ET
q 0.10 0.25 0.55 rg 370 ${totY - 68} 190 22 re f Q
BT /F2 11 Tf 380 ${totY - 58} Td 1 1 1 rg (TOTAL: ${fmtINR(d.total)}) Tj ET
0 0 0 rg
BT /F1 8 Tf 370 ${totY - 78} Td 0.10 0.25 0.55 rg (ETH Equivalent: ${d.totalETH} ETH) Tj ET
0 0 0 rg
BT /F2 9 Tf 40 185 Td 0 0 0 rg (PAYMENT DETAILS:) Tj ET
BT /F1 9 Tf 40 171 Td (Bank: ${d.bank}    A/C No: ${d.accNo}    IFSC: ${d.ifsc}) Tj ET
q 0.92 0.97 0.92 rg 35 110 525 48 re f Q
BT /F2 9 Tf 45 150 Td 0.05 0.45 0.05 rg (BLOCKCHAIN NFT INVOICE) Tj ET
BT /F1 8 Tf 45 137 Td 0 0 0 rg (This invoice is tokenized as an ERC-721 NFT on Ethereum. The IPFS hash of this document is stored) Tj ET
BT /F1 8 Tf 45 125 Td (immutably in the smart contract. Unique ID: ${d.uniqueId}) Tj ET
q 0.10 0.25 0.55 rg 0 0 595 28 re f Q
BT /F1 7 Tf 40 11 Td 1 1 1 rg (Generated: ${new Date().toISOString()}   This is a computer-generated document.) Tj ET
BT /F1 7 Tf 360 11 Td (PES University NFT Invoice DApp - IEEE Paper) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj
xref
0 7
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000280 00000 n
0000004600 00000 n
0000004678 00000 n
trailer << /Size 7 /Root 1 0 R >>
startxref
4760
%%EOF`;
  return Buffer.from(content, "utf8");
}

async function main() {
  console.log("=".repeat(55));
  console.log("  Invoice PDF Generator — InvoiceNFT DApp");
  console.log("=".repeat(55));
  console.log(`  Generating ${COUNT} invoice PDFs → ${OUT}\n`);
  const index = [];

  for (let i = 0; i < COUNT; i++) {
    const d    = buildInvoice(i);
    const name = `${d.invNo}.pdf`;
    fs.writeFileSync(path.join(OUT, name), makePDF(d));
    index.push({
      index: i, filename: name,
      invoiceNumber: d.invNo, date: d.date, dueDate: d.dueDate, daysNet: d.days,
      supplier: d.sup.name, buyer: d.buy.name,
      subtotalINR: d.subtotal, gstINR: d.gst, totalINR: d.total, totalETH: d.totalETH,
      items: d.items.length,
      mintInvoiceParams: {
        invoiceAmountEth: d.totalETH,
        dueDate: d.dueDate,
        note: `Attach file: ${name}`,
      },
    });
    console.log(`  [${i+1}/${COUNT}] ${name}`);
    console.log(`        Supplier : ${d.sup.name} → Buyer: ${d.buy.name}`);
    console.log(`        Amount   : Rs.${d.total.toLocaleString("en-IN")} = ${d.totalETH} ETH`);
    console.log(`        Due Date : ${d.dueDate} (Net ${d.days} days)\n`);
  }

  fs.writeFileSync(path.join(OUT, "invoices.json"), JSON.stringify(index, null, 2));

  console.log("=".repeat(55));
  console.log(`  DONE! ${COUNT} PDFs saved to: ${OUT}`);
  console.log(`  Index: ${path.join(OUT, "invoices.json")}`);
  console.log("\n  HOW TO USE:");
  console.log("  1. Open http://localhost:3000 → Create Invoice");
  console.log("  2. Upload any PDF from generated-invoices/");
  console.log("  3. Use invoiceAmountEth and dueDate from invoices.json");
  console.log("=".repeat(55));
}

main().catch(console.error);
