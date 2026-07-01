"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const pdfLib = require("pdf-lib");
const zod = require("zod");
const XLSX = require("xlsx");
const fs = require("fs/promises");
const crypto = require("crypto");
const os = require("os");
const Store = require("electron-store");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const XLSX__namespace = /* @__PURE__ */ _interopNamespaceDefault(XLSX);
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/quincaillerie";
const DEFAULT_PORT = 3847;
const REFERENCE_PREFIXES = {
  product: "PRD",
  customer: "CLI",
  supplier: "FRN",
  purchase: "ACH",
  invoice: "FAC",
  purchaseOrder: "BC",
  purchaseSlip: "BA",
  inventory: "INV"
};
const REFERENCE_PAD = 6;
const DEFAULT_SETTINGS = {
  companyName: "Ma Quincaillerie",
  companyAddress: "",
  companyPhone: "",
  defaultTva: 19,
  currency: "DT",
  invoiceFormat: "FAC-{year}-{number}",
  mongoUri: DEFAULT_MONGO_URI
};
const TIMBRE_FISCAL_AMOUNT = 1;
let isConnected = false;
async function connectDatabase(uri = DEFAULT_MONGO_URI) {
  if (isConnected) return;
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5e3
  });
  isConnected = true;
  console.log("[DB] Connected to MongoDB");
}
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "cashier"], required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);
const productSchema$1 = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    barcode: { type: String, sparse: true, index: true },
    designation: { type: String, required: true, index: true },
    description: String,
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    brand: String,
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    purchasePrice: { type: Number, required: true, default: 0 },
    salePrice: { type: Number, required: true, default: 0 },
    profitMargin: { type: Number, required: true, default: 25 },
    discount: { type: Number, required: true, default: 0 },
    tva: { type: Number, required: true, default: 19 },
    subjectToFodec: { type: Boolean, default: false },
    stock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true, default: "pièce" },
    location: String,
    photo: String,
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
productSchema$1.index({ designation: "text", reference: "text", barcode: "text" });
const categorySchema$1 = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: String,
    prefix: { type: String, required: true, unique: true, trim: true, uppercase: true },
    counter: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);
const subCategorySchema$1 = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true, trim: true },
    description: String
  },
  { timestamps: true }
);
subCategorySchema$1.index({ categoryId: 1, name: 1 }, { unique: true });
const supplierSchema$1 = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    companyName: { type: String, required: true, index: true },
    taxId: String,
    phone: String,
    email: String,
    address: String,
    contactName: String,
    balance: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const customerSchema$1 = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    name: { type: String, required: true, index: true },
    phone: String,
    address: String,
    email: String,
    creditBalance: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const purchaseOrderLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    designation: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    receivedQuantity: { type: Number, default: 0 }
  },
  { _id: false }
);
const purchaseOrderSchema$1 = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    lines: [purchaseOrderLineSchema],
    status: {
      type: String,
      enum: ["draft", "sent", "partial", "received"],
      default: "draft"
    },
    totalHT: { type: Number, default: 0 },
    notes: String,
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["none", "paid", "unpaid", "partial"],
      default: "none"
    }
  },
  { timestamps: true }
);
const purchaseReceiptSchema = new mongoose.Schema(
  {
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    reference: { type: String, required: true, unique: true },
    lines: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true }
      }
    ],
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notes: String
  },
  { timestamps: true }
);
const supplierInvoiceSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder" },
    reference: { type: String, required: true },
    amount: { type: Number, required: true },
    filePath: String,
    fileType: { type: String, enum: ["pdf", "image"] }
  },
  { timestamps: true }
);
const saleLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    reference: String,
    designation: String,
    quantity: Number,
    unitPrice: Number,
    discount: { type: Number, default: 0 },
    tva: Number,
    totalHT: Number,
    totalTVA: Number,
    totalTTC: Number
  },
  { _id: false }
);
const saleSchema$1 = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    purchaseSlipId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseSlip" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lines: [saleLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    totalFodec: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "mixed", "credit"],
      required: true
    },
    cashReceived: Number,
    cardAmount: Number,
    change: Number,
    includeTva: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const purchaseSlipSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    lines: [saleLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    totalFodec: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    isSettled: { type: Boolean, default: false },
    convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    includeTva: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const invoiceSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    lines: [saleLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    totalFodec: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: true },
    includeTva: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const paymentSchema$1 = new mongoose.Schema(
  {
    type: { type: String, enum: ["customer", "supplier"], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    purchaseSlipId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseSlip" },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder" },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cash", "card", "mixed", "credit"],
      required: true
    },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
const stockMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: { type: String, enum: ["in", "out"], required: true },
    reason: {
      type: String,
      enum: ["purchase", "sale", "correction", "inventory"],
      required: true
    },
    quantity: { type: Number, required: true },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    reference: String,
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    lines: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        designation: String,
        theoreticalStock: Number,
        actualStock: Number,
        difference: Number
      }
    ],
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
const settingsSchema$1 = new mongoose.Schema(
  {
    companyName: { type: String, required: true, default: "Ma Quincaillerie" },
    companyAddress: String,
    companyPhone: String,
    companyLogo: String,
    defaultTva: { type: Number, default: 19 },
    currency: { type: String, default: "DT" },
    invoiceFormat: { type: String, default: "FAC-{year}-{number}" },
    mongoUri: { type: String, default: "mongodb://127.0.0.1:27017/quincaillerie" }
  },
  { timestamps: true }
);
const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    action: { type: String, enum: ["create", "update", "delete"], required: true },
    targetCollection: { type: String, required: true },
    documentId: { type: String, required: true },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
});
const expenseSchema$1 = new mongoose.Schema(
  {
    label: { type: String, required: true },
    category: {
      type: String,
      enum: ["merchandise", "transport", "rent", "electricity", "other"],
      required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
const User = mongoose.models.User ?? mongoose.model("User", userSchema);
const Product = mongoose.models.Product ?? mongoose.model("Product", productSchema$1);
const Category = mongoose.models.Category ?? mongoose.model("Category", categorySchema$1);
const SubCategory = mongoose.models.SubCategory ?? mongoose.model("SubCategory", subCategorySchema$1);
const Supplier = mongoose.models.Supplier ?? mongoose.model("Supplier", supplierSchema$1);
const Customer = mongoose.models.Customer ?? mongoose.model("Customer", customerSchema$1);
const PurchaseOrder = mongoose.models.PurchaseOrder ?? mongoose.model("PurchaseOrder", purchaseOrderSchema$1);
const PurchaseReceipt = mongoose.models.PurchaseReceipt ?? mongoose.model("PurchaseReceipt", purchaseReceiptSchema);
const SupplierInvoice = mongoose.models.SupplierInvoice ?? mongoose.model("SupplierInvoice", supplierInvoiceSchema);
const Sale = mongoose.models.Sale ?? mongoose.model("Sale", saleSchema$1);
const PurchaseSlip = mongoose.models.PurchaseSlip ?? mongoose.model("PurchaseSlip", purchaseSlipSchema);
const Invoice = mongoose.models.Invoice ?? mongoose.model("Invoice", invoiceSchema);
const Payment = mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema$1);
const StockMovement = mongoose.models.StockMovement ?? mongoose.model("StockMovement", stockMovementSchema);
const InventoryAdjustment = mongoose.models.InventoryAdjustment ?? mongoose.model("InventoryAdjustment", inventoryAdjustmentSchema);
const Settings = mongoose.models.Settings ?? mongoose.model("Settings", settingsSchema$1);
const AuditLog = mongoose.models.AuditLog ?? mongoose.model("AuditLog", auditLogSchema);
const Counter = mongoose.models.Counter ?? mongoose.model("Counter", counterSchema);
const Expense = mongoose.models.Expense ?? mongoose.model("Expense", expenseSchema$1);
const SYSTEM_USER_ID$1 = new mongoose.Types.ObjectId("000000000000000000000001");
const DEFAULT_CATEGORIES = [
  { name: "Plomberie", prefix: "PL", description: "Tuyauterie, robinetterie et accessoires sanitaires" },
  { name: "Électricité", prefix: "EL", description: "Câbles, interrupteurs, disjoncteurs et éclairage" },
  { name: "Peinture", prefix: "PA", description: "Peintures, pinceaux, rouleaux et solvants" },
  { name: "Bricolage", prefix: "BR", description: "Outillage, quincaillerie générale et fixation" }
];
async function seedDatabase() {
  await User.findOneAndUpdate(
    { _id: SYSTEM_USER_ID$1 },
    {
      username: "system",
      password: "n/a",
      role: "admin",
      isActive: true
    },
    { upsert: true }
  );
  const settingsCount = await Settings.countDocuments();
  if (settingsCount === 0) {
    await Settings.create(DEFAULT_SETTINGS);
    console.log("[DB] Default settings created");
  }
  for (const cat of DEFAULT_CATEGORIES) {
    await Category.findOneAndUpdate(
      { prefix: cat.prefix },
      {
        $setOnInsert: {
          name: cat.name,
          description: cat.description,
          counter: 0
        }
      },
      { upsert: true }
    );
  }
  console.log("[DB] Default categories seeded");
  const counterKeys = [
    "customer",
    "supplier",
    "purchase",
    "invoice",
    "purchaseSlip",
    "purchaseOrder",
    "inventory",
    "purchaseReceipt"
  ];
  for (const key of counterKeys) {
    await Counter.findOneAndUpdate({ key }, { $setOnInsert: { value: 0 } }, { upsert: true });
  }
}
function sendSuccess(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}
function sendError(res, message, status = 400, errors) {
  res.status(status).json({ success: false, error: { message, errors } });
}
function handleZodError(res, error) {
  const errors = {};
  for (const issue of error.issues) {
    const path2 = issue.path.join(".");
    if (!errors[path2]) errors[path2] = [];
    errors[path2].push(issue.message);
  }
  sendError(res, "Données invalides", 400, errors);
}
function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}
const SYSTEM_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");
function attachActor(req, _res, next) {
  req.actorId = SYSTEM_USER_ID.toString();
  next();
}
function getActorId(req) {
  return req.actorId || SYSTEM_USER_ID.toString();
}
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 160;
const TABLE = {
  designation: { x: MARGIN, w: 215 },
  qty: { x: MARGIN + 218, w: 32 },
  pu: { x: MARGIN + 253, w: 62 },
  ht: { x: MARGIN + 318, w: 72 },
  ttc: { x: MARGIN + 393, w: CONTENT_W - 393 }
};
const FONT_SIZE = 9;
const LINE_GAP = 13;
const CELL_PAD_TOP = 10;
const CELL_PAD_BOTTOM = 10;
const ROW_H_SINGLE = CELL_PAD_TOP + FONT_SIZE + CELL_PAD_BOTTOM;
const ROW_H_MULTILINE = CELL_PAD_TOP + FONT_SIZE + LINE_GAP + FONT_SIZE + CELL_PAD_BOTTOM;
function sanitizePdfText(text) {
  return text.replace(/\u2212|\u2013|\u2014/g, "-").replace(/\u2026/g, "...").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u00A0/g, " ");
}
function fmt(amount, currency) {
  return `${amount.toFixed(3)} ${currency}`;
}
function textWidth(font, text, size) {
  return font.widthOfTextAtSize(sanitizePdfText(text), size);
}
function truncate(font, text, size, maxW) {
  const safe = sanitizePdfText(text);
  if (textWidth(font, safe, size) <= maxW) return safe;
  let s = safe;
  while (s.length > 1 && textWidth(font, s + "...", size) > maxW) {
    s = s.slice(0, -1);
  }
  return s + "...";
}
function wrapLines(font, text, size, maxW) {
  const safe = sanitizePdfText(text);
  const words = safe.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(font, candidate, size) <= maxW) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = textWidth(font, word, size) > maxW ? truncate(font, word, size, maxW) : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines.slice(0, 2) : [""];
}
function drawLeft(page2, text, x, y, font, size, color = pdfLib.rgb(0.1, 0.1, 0.1)) {
  page2.drawText(sanitizePdfText(text), { x, y, size, font, color });
}
function drawRight(page2, text, colX, colW, y, font, size, color = pdfLib.rgb(0.1, 0.1, 0.1)) {
  const w = textWidth(font, text, size);
  page2.drawText(sanitizePdfText(text), { x: colX + colW - w, y, size, font, color });
}
function drawHLine(page2, y, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
  page2.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.5,
    color: pdfLib.rgb(0.82, 0.82, 0.82)
  });
}
function addPage(ctx) {
  const page2 = ctx.doc.addPage([PAGE_W, PAGE_H]);
  return { ...ctx, page: page2, y: PAGE_H - MARGIN };
}
function ensureSpace(ctx, needed, repeatHeader = false) {
  if (ctx.y - needed < MARGIN + FOOTER_ZONE) {
    const newCtx = addPage(ctx);
    return repeatHeader ? drawTableHeader(newCtx) : newCtx;
  }
  return ctx;
}
function drawTableHeader(ctx) {
  const { page: page2, fontBold, y } = ctx;
  page2.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: CONTENT_W,
    height: 22,
    color: pdfLib.rgb(0.94, 0.94, 0.94)
  });
  const hy = y;
  drawLeft(page2, "Désignation", TABLE.designation.x + 4, hy, fontBold, 8);
  drawRight(page2, "Qté", TABLE.qty.x, TABLE.qty.w, hy, fontBold, 8);
  drawRight(page2, "P.U. HT", TABLE.pu.x, TABLE.pu.w, hy, fontBold, 8);
  drawRight(page2, "Total HT", TABLE.ht.x, TABLE.ht.w, hy, fontBold, 8);
  drawRight(page2, "Total TTC", TABLE.ttc.x, TABLE.ttc.w, hy, fontBold, 8);
  const headerBottom = y - 22;
  drawHLine(page2, headerBottom, MARGIN, PAGE_W - MARGIN);
  return { ...ctx, y: headerBottom - 4 };
}
function drawTotalsBlock(ctx, inv, cfg, title) {
  let { page: page2, font, fontBold, y } = ctx;
  const currency = cfg.currency;
  const blockW = 230;
  const blockX = PAGE_W - MARGIN - blockW;
  const labelX = blockX;
  const valueW = 95;
  const valueX = blockX + blockW - valueW;
  y -= 8;
  drawHLine(page2, y, blockX, PAGE_W - MARGIN);
  y -= 18;
  const drawTotalRow = (label, value, bold = false, valueColor = pdfLib.rgb(0.1, 0.1, 0.1)) => {
    const f = bold ? fontBold : font;
    const sz = bold ? 10 : 9;
    drawLeft(page2, label, labelX, y, f, sz);
    drawRight(page2, value, valueX, valueW, y, f, sz, valueColor);
    y -= bold ? 18 : 15;
  };
  drawTotalRow("Total HT", fmt(inv.totalHT, currency));
  if ((inv.totalFodec ?? 0) > 0) {
    drawTotalRow("FODEC (1%)", fmt(inv.totalFodec, currency));
  }
  if (inv.includeTva) {
    drawTotalRow("TVA", fmt(inv.totalTVA, currency));
  }
  const isInvoice = title === "FACTURE";
  const timbreAmount = isInvoice ? (inv.timbreFiscal ?? 0) > 0 ? inv.timbreFiscal : TIMBRE_FISCAL_AMOUNT : inv.timbreFiscal ?? 0;
  if (isInvoice || timbreAmount > 0) {
    drawTotalRow("Timbre fiscal", fmt(timbreAmount, currency));
  }
  drawTotalRow("TOTAL TTC", fmt(inv.totalTTC, currency), true);
  y -= 4;
  drawHLine(page2, y + 10, blockX, PAGE_W - MARGIN);
  const paidLabel = title === "BON D'ACHAT" ? "Montant payé" : "Somme versée";
  drawTotalRow(paidLabel, fmt(inv.amountPaid, currency), false, pdfLib.rgb(0.1, 0.45, 0.2));
  const dueColor = inv.amountDue > 0 ? pdfLib.rgb(0.75, 0.15, 0.15) : pdfLib.rgb(0.1, 0.45, 0.2);
  drawTotalRow("Reste à payer", fmt(inv.amountDue, currency), true, dueColor);
  return { ...ctx, y };
}
async function generateInvoicePdf(invoice, settings, title = "FACTURE") {
  const inv = "toObject" in invoice ? invoice.toObject() : invoice;
  const cfg = "toObject" in settings ? settings.toObject() : settings;
  const isInvoice = title === "FACTURE";
  const titleColor = isInvoice ? pdfLib.rgb(0.85, 0.35, 0.08) : pdfLib.rgb(0.15, 0.38, 0.72);
  const doc = await pdfLib.PDFDocument.create();
  const font = await doc.embedFont(pdfLib.StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(pdfLib.StandardFonts.HelveticaBold);
  let ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font,
    fontBold,
    y: PAGE_H - MARGIN
  };
  const { page: page2 } = ctx;
  const companyLines = [cfg.companyName];
  if (cfg.companyAddress) companyLines.push(cfg.companyAddress);
  if (cfg.companyPhone) companyLines.push(`Tél : ${cfg.companyPhone}`);
  let leftY = ctx.y;
  companyLines.forEach((line, i) => {
    const f = i === 0 ? fontBold : font;
    const sz = i === 0 ? 14 : 9;
    const display = i === 0 ? truncate(fontBold, line, sz, 280) : truncate(font, line, sz, 280);
    drawLeft(page2, display, MARGIN, leftY, f, sz, pdfLib.rgb(0.15, 0.15, 0.15));
    leftY -= i === 0 ? 18 : 13;
  });
  const rightBlockX = PAGE_W - MARGIN - 200;
  let rightY = PAGE_H - MARGIN;
  drawLeft(page2, title, rightBlockX, rightY, fontBold, 16, titleColor);
  rightY -= 20;
  drawLeft(page2, `N° ${inv.reference}`, rightBlockX, rightY, fontBold, 10);
  rightY -= 14;
  drawLeft(
    page2,
    `Date : ${new Date(inv.createdAt).toLocaleDateString("fr-FR")}`,
    rightBlockX,
    rightY,
    font,
    9,
    pdfLib.rgb(0.4, 0.4, 0.4)
  );
  ctx.y = Math.min(leftY, rightY) - 20;
  drawHLine(ctx.page, ctx.y);
  ctx.y -= 22;
  drawLeft(ctx.page, "CLIENT", MARGIN, ctx.y, fontBold, 7, pdfLib.rgb(0.55, 0.55, 0.55));
  ctx.y -= 13;
  const clientName = inv.customerName || "Client comptant";
  drawLeft(ctx.page, truncate(fontBold, clientName, 12, CONTENT_W), MARGIN, ctx.y, fontBold, 12);
  ctx.y -= 28;
  ctx = drawTableHeader(ctx);
  for (const line of inv.lines) {
    const discountLabel = line.discount && line.discount > 0 ? ` (-${line.discount}%)` : "";
    const designation = line.designation + discountLabel;
    const wrapped = wrapLines(ctx.font, designation, FONT_SIZE, TABLE.designation.w - 8);
    const isMultiline = wrapped.length > 1;
    const rowH = isMultiline ? ROW_H_MULTILINE : ROW_H_SINGLE;
    ctx = ensureSpace(ctx, rowH + 2, true);
    const textY = ctx.y - CELL_PAD_TOP;
    wrapped.forEach((ln, i) => {
      drawLeft(ctx.page, ln, TABLE.designation.x + 4, textY - i * LINE_GAP, ctx.font, FONT_SIZE);
    });
    const numsY = isMultiline ? textY - LINE_GAP / 2 : textY;
    drawRight(ctx.page, String(line.quantity), TABLE.qty.x, TABLE.qty.w, numsY, ctx.font, FONT_SIZE);
    drawRight(ctx.page, line.unitPrice.toFixed(3), TABLE.pu.x, TABLE.pu.w, numsY, ctx.font, FONT_SIZE);
    drawRight(ctx.page, line.totalHT.toFixed(3), TABLE.ht.x, TABLE.ht.w, numsY, ctx.font, FONT_SIZE);
    drawRight(ctx.page, line.totalTTC.toFixed(3), TABLE.ttc.x, TABLE.ttc.w, numsY, ctx.font, FONT_SIZE);
    ctx.y -= rowH;
    drawHLine(ctx.page, ctx.y, MARGIN, PAGE_W - MARGIN);
  }
  ctx = ensureSpace(ctx, FOOTER_ZONE);
  ctx = drawTotalsBlock(ctx, inv, cfg, title);
  const footerY = MARGIN - 10;
  drawLeft(
    ctx.page,
    `${cfg.companyName} — ${title} ${inv.reference}`,
    MARGIN,
    footerY,
    ctx.font,
    7,
    pdfLib.rgb(0.6, 0.6, 0.6)
  );
  return doc.save();
}
async function generatePurchaseSlipPdf(slip, settings) {
  return generateInvoicePdf(slip, settings, "BON D'ACHAT");
}
function generatePurchaseSlipEscPos(slip, settings) {
  const s = "toObject" in slip ? slip.toObject() : slip;
  const cfg = "toObject" in settings ? settings.toObject() : settings;
  const ESC = "\x1B";
  const GS = "";
  const lines = [];
  lines.push(`${ESC}@`);
  lines.push(`${ESC}a`);
  lines.push(`${ESC}!${cfg.companyName}
`);
  lines.push(`${ESC}!\0`);
  if (cfg.companyAddress) lines.push(`${cfg.companyAddress}
`);
  if (cfg.companyPhone) lines.push(`Tel: ${cfg.companyPhone}
`);
  lines.push("--------------------------------\n");
  lines.push(`${ESC}!BON D'ACHAT
`);
  lines.push(`${ESC}!\0`);
  lines.push(`N°: ${s.reference}
`);
  lines.push(`Date: ${new Date(s.createdAt).toLocaleString("fr-FR")}
`);
  lines.push(`Client: ${s.customerName || "—"}
`);
  lines.push("--------------------------------\n");
  for (const line of s.lines) {
    const discountLabel = line.discount && line.discount > 0 ? ` -${line.discount}%` : "";
    lines.push(`${line.designation.substring(0, 22)}${discountLabel}
`);
    lines.push(` ${line.quantity} x ${line.unitPrice.toFixed(3)} = ${line.totalTTC.toFixed(3)}
`);
  }
  lines.push("--------------------------------\n");
  lines.push(`HT: ${s.totalHT.toFixed(3)} ${cfg.currency}
`);
  if ((s.totalFodec ?? 0) > 0) {
    lines.push(`FODEC: ${s.totalFodec.toFixed(3)} ${cfg.currency}
`);
  }
  if (s.includeTva) {
    lines.push(`TVA: ${s.totalTVA.toFixed(3)} ${cfg.currency}
`);
  }
  if ((s.timbreFiscal ?? 0) > 0) {
    lines.push(`Timbre: ${s.timbreFiscal.toFixed(3)} ${cfg.currency}
`);
  }
  lines.push(`TOTAL: ${s.totalTTC.toFixed(3)} ${cfg.currency}
`);
  lines.push(`PAYE: ${s.amountPaid.toFixed(3)} ${cfg.currency}
`);
  lines.push(`${ESC}!\bRESTE: ${s.amountDue.toFixed(3)} ${cfg.currency}
`);
  lines.push(`${ESC}!\0`);
  lines.push("\n\n\n");
  lines.push(`${GS}V\0`);
  return Buffer.from(lines.join(""), "binary");
}
function generateReceiptEscPos(invoice, settings) {
  const inv = "toObject" in invoice ? invoice.toObject() : invoice;
  const cfg = "toObject" in settings ? settings.toObject() : settings;
  const ESC = "\x1B";
  const GS = "";
  const lines = [];
  lines.push(`${ESC}@`);
  lines.push(`${ESC}a`);
  lines.push(`${ESC}!${cfg.companyName}
`);
  lines.push(`${ESC}!\0`);
  if (cfg.companyAddress) lines.push(`${cfg.companyAddress}
`);
  if (cfg.companyPhone) lines.push(`Tel: ${cfg.companyPhone}
`);
  lines.push("--------------------------------\n");
  lines.push(`Facture: ${inv.reference}
`);
  lines.push(`Date: ${new Date(inv.createdAt).toLocaleString("fr-FR")}
`);
  lines.push(`Client: ${inv.customerName || "Comptant"}
`);
  lines.push("--------------------------------\n");
  lines.push("Designation    Qte  PU    TTC\n");
  lines.push("--------------------------------\n");
  for (const line of inv.lines) {
    const discountLabel = line.discount && line.discount > 0 ? ` -${line.discount}%` : "";
    lines.push(`${line.designation.substring(0, 20)}${discountLabel}
`);
    lines.push(` ${line.quantity} x ${line.unitPrice.toFixed(3)} = ${line.totalTTC.toFixed(3)}
`);
  }
  lines.push("--------------------------------\n");
  lines.push(`HT: ${inv.totalHT.toFixed(3)} ${cfg.currency}
`);
  if ((inv.totalFodec ?? 0) > 0) {
    lines.push(`FODEC: ${inv.totalFodec.toFixed(3)} ${cfg.currency}
`);
  }
  if (inv.includeTva) {
    lines.push(`TVA: ${inv.totalTVA.toFixed(3)} ${cfg.currency}
`);
  }
  const timbreAmount = (inv.timbreFiscal ?? 0) > 0 ? inv.timbreFiscal : TIMBRE_FISCAL_AMOUNT;
  lines.push(`Timbre: ${timbreAmount.toFixed(3)} ${cfg.currency}
`);
  lines.push(`TOTAL: ${inv.totalTTC.toFixed(3)} ${cfg.currency}
`);
  lines.push(`Verse: ${inv.amountPaid.toFixed(3)} ${cfg.currency}
`);
  lines.push(`Reste: ${inv.amountDue.toFixed(3)} ${cfg.currency}
`);
  lines.push("\n\n\n");
  lines.push(`${GS}V\0`);
  return Buffer.from(lines.join(""), "binary");
}
const router$8 = express.Router();
router$8.use(attachActor);
router$8.get("/invoices/:id/pdf", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    sendError(res, "Facture introuvable", 404);
    return;
  }
  const settings = await Settings.findOne() ?? await Settings.create({});
  const pdfBytes = await generateInvoicePdf(invoice, settings);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${invoice.reference}.pdf`);
  res.send(Buffer.from(pdfBytes));
}));
router$8.get("/purchase-slips/:id/pdf", asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findById(req.params.id);
  if (!slip) {
    sendError(res, "Bon d'achat introuvable", 404);
    return;
  }
  const settings = await Settings.findOne() ?? await Settings.create({});
  const pdfBytes = await generatePurchaseSlipPdf(slip, settings);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${slip.reference}.pdf`);
  res.send(Buffer.from(pdfBytes));
}));
const optionalId = zod.z.preprocess(
  (val) => val === "" || val === null ? void 0 : val,
  zod.z.string().optional()
);
zod.z.object({
  username: zod.z.string().min(1, "Nom d'utilisateur requis"),
  password: zod.z.string().min(1, "Mot de passe requis")
});
zod.z.object({
  currentPassword: zod.z.string().min(1, "Mot de passe actuel requis"),
  newPassword: zod.z.string().min(6, "Minimum 6 caractères"),
  confirmPassword: zod.z.string().min(1, "Confirmation requise")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});
const productSchema = zod.z.object({
  reference: zod.z.string().optional(),
  barcode: zod.z.string().optional(),
  designation: zod.z.string().min(1, "Désignation requise"),
  description: zod.z.string().optional(),
  categoryId: zod.z.string().min(1, "Catégorie requise"),
  subCategoryId: optionalId,
  brand: zod.z.string().optional(),
  supplierId: optionalId,
  purchasePrice: zod.z.number().min(0, "Prix achat invalide"),
  salePrice: zod.z.number().min(0, "Prix vente invalide").optional(),
  profitMargin: zod.z.number().min(0, "Marge invalide").max(1e3).default(25),
  discount: zod.z.number().min(0, "Remise invalide").max(100).default(0),
  tva: zod.z.number().min(0).max(100),
  subjectToFodec: zod.z.boolean().optional().default(false),
  stock: zod.z.number().min(0).default(0),
  minStock: zod.z.number().min(0).default(0),
  unit: zod.z.string().min(1, "Unité requise"),
  location: zod.z.string().optional()
});
const categorySchema = zod.z.object({
  name: zod.z.string().min(1, "Nom requis"),
  description: zod.z.string().optional(),
  prefix: zod.z.string().min(2, "Préfixe requis (2 lettres minimum)").max(5).toUpperCase(),
  counter: zod.z.number().optional()
});
const subCategorySchema = zod.z.object({
  categoryId: zod.z.string().min(1, "Catégorie requise"),
  name: zod.z.string().min(1, "Nom requis"),
  description: zod.z.string().optional()
});
const supplierSchema = zod.z.object({
  companyName: zod.z.string().min(1, "Raison sociale requise"),
  taxId: zod.z.string().optional(),
  phone: zod.z.string().optional(),
  email: zod.z.string().email("Email invalide").optional().or(zod.z.literal("")),
  address: zod.z.string().optional(),
  contactName: zod.z.string().optional()
});
const customerSchema = zod.z.object({
  name: zod.z.string().min(1, "Nom requis"),
  phone: zod.z.string().optional(),
  address: zod.z.string().optional(),
  email: zod.z.string().email("Email invalide").optional().or(zod.z.literal(""))
});
const purchaseOrderSchema = zod.z.object({
  supplierId: zod.z.string().min(1, "Fournisseur requis"),
  lines: zod.z.array(
    zod.z.object({
      productId: zod.z.string().min(1),
      designation: zod.z.string(),
      quantity: zod.z.number().min(1),
      unitPrice: zod.z.number().min(0)
    })
  ).min(1, "Au moins un produit requis"),
  notes: zod.z.string().optional()
});
const quickReceiveSchema = purchaseOrderSchema.extend({
  updatePurchasePrices: zod.z.boolean().optional().default(true),
  recordDebt: zod.z.boolean().optional().default(false)
});
const purchaseReceivePaymentSchema = zod.z.object({
  mode: zod.z.enum(["paid", "credit", "partial"]),
  amountPaid: zod.z.number().min(0).optional(),
  method: zod.z.enum(["cash", "card", "mixed"]).optional()
}).superRefine((data, ctx) => {
  if (data.mode === "partial" && (data.amountPaid === void 0 || data.amountPaid <= 0)) {
    ctx.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "Montant payé requis pour un paiement partiel",
      path: ["amountPaid"]
    });
  }
});
const purchaseOrderPaySchema = zod.z.object({
  amount: zod.z.number().positive("Montant invalide"),
  method: zod.z.enum(["cash", "card", "mixed"]),
  notes: zod.z.string().optional()
});
const saleSchema = zod.z.object({
  customerId: optionalId,
  customerName: zod.z.string().optional(),
  lines: zod.z.array(
    zod.z.object({
      productId: zod.z.string().min(1),
      quantity: zod.z.number().min(1),
      discount: zod.z.number().optional()
    })
  ).min(1, "Panier vide"),
  paymentMethod: zod.z.enum(["cash", "card", "mixed", "credit"]),
  amountPaid: zod.z.number().min(0).optional(),
  cashReceived: zod.z.number().optional(),
  cardAmount: zod.z.number().optional(),
  includeTva: zod.z.boolean().optional().default(false)
}).superRefine((data, ctx) => {
  const hasCustomer = !!(data.customerId || data.customerName?.trim());
  const isCredit = data.paymentMethod === "credit";
  const partialPaid = data.amountPaid !== void 0 && data.amountPaid >= 0;
  if ((isCredit || partialPaid) && !hasCustomer) {
    ctx.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "Un client est requis pour une vente à crédit ou un paiement partiel",
      path: ["customerName"]
    });
  }
});
const paymentSchema = zod.z.object({
  type: zod.z.enum(["customer", "supplier"]),
  entityId: zod.z.string().min(1),
  invoiceId: optionalId,
  purchaseSlipId: optionalId,
  purchaseOrderId: optionalId,
  amount: zod.z.number().positive("Montant invalide"),
  method: zod.z.enum(["cash", "card", "mixed"]),
  notes: zod.z.string().optional()
});
const settingsSchema = zod.z.object({
  companyName: zod.z.string().min(1, "Nom société requis"),
  companyAddress: zod.z.string().optional(),
  companyPhone: zod.z.string().optional(),
  defaultTva: zod.z.coerce.number().min(0).max(100),
  currency: zod.z.string().min(1),
  invoiceFormat: zod.z.string().min(1),
  mongoUri: zod.z.string().min(1).optional()
});
zod.z.object({
  username: zod.z.string().min(3, "Minimum 3 caractères"),
  password: zod.z.string().min(6, "Minimum 6 caractères"),
  role: zod.z.enum(["admin", "cashier"])
});
const updateInvoiceSchema = zod.z.object({
  customerName: zod.z.string().min(1, "Nom client requis")
});
const expenseSchema = zod.z.object({
  label: zod.z.string().min(1, "Libellé requis"),
  category: zod.z.enum(["merchandise", "transport", "rent", "electricity", "other"]),
  amount: zod.z.number().positive("Montant invalide"),
  date: zod.z.string().min(1, "Date requise"),
  notes: zod.z.string().optional()
});
function formatReference(prefix, counter, year) {
  const padded = String(counter).padStart(REFERENCE_PAD, "0");
  if (year !== void 0) {
    return `${prefix}-${year}-${padded}`;
  }
  return `${prefix}-${padded}`;
}
function roundMoney(value) {
  return Math.round(value * 1e3) / 1e3;
}
function calculateTVA(ht, tvaRate) {
  return roundMoney(ht * (tvaRate / 100));
}
function calculateFodec(htBase, ratePercent = 1) {
  if (htBase <= 0) return 0;
  return roundMoney(htBase * (ratePercent / 100));
}
function calculateSalePrice(purchasePrice, profitMargin) {
  if (profitMargin >= 100) return roundMoney(purchasePrice * (profitMargin / 100 + 1));
  return roundMoney(purchasePrice / (1 - profitMargin / 100));
}
function applyDiscount(amount, discountPercent) {
  return roundMoney(amount * (1 - discountPercent / 100));
}
function getReceivedHT(lines) {
  return roundMoney(
    lines.reduce((s, l) => s + (l.receivedQuantity ?? 0) * l.unitPrice, 0)
  );
}
function computePurchasePayment(lines, amountPaid) {
  const receivedHT = getReceivedHT(lines);
  const paid = roundMoney(amountPaid || 0);
  if (receivedHT <= 0) {
    return { paymentStatus: "none", amountDue: 0, receivedHT: 0 };
  }
  const amountDue = roundMoney(Math.max(0, receivedHT - paid));
  let paymentStatus;
  if (amountDue <= 0) paymentStatus = "paid";
  else if (paid <= 0) paymentStatus = "unpaid";
  else paymentStatus = "partial";
  return { paymentStatus, amountDue, receivedHT };
}
function resolveSalePayment(totalTTC, paymentMethod, options) {
  let paid;
  if (options?.amountPaid !== void 0) {
    paid = roundMoney(Math.min(Math.max(0, options.amountPaid), totalTTC));
  } else if (paymentMethod === "credit") {
    paid = 0;
  } else if (paymentMethod === "card") {
    paid = totalTTC;
  } else if (paymentMethod === "mixed") {
    paid = roundMoney(Math.min((options?.cashReceived ?? 0) + (options?.cardAmount ?? 0), totalTTC));
  } else {
    const received = options?.cashReceived ?? totalTTC;
    paid = roundMoney(Math.min(received, totalTTC));
    const change = received > totalTTC ? roundMoney(received - totalTTC) : void 0;
    return { amountPaid: paid, amountDue: roundMoney(totalTTC - paid), change };
  }
  return {
    amountPaid: paid,
    amountDue: roundMoney(totalTTC - paid)
  };
}
function getDayBounds(date = /* @__PURE__ */ new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
async function getNextReference(key, withYear = false) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  const prefix = REFERENCE_PREFIXES[key] ?? key;
  const year = withYear ? (/* @__PURE__ */ new Date()).getFullYear() : void 0;
  return formatReference(prefix, counter.value, year);
}
async function getNextProductReference(categoryId) {
  const category = await Category.findOneAndUpdate(
    { _id: categoryId },
    { $inc: { counter: 1 } },
    { upsert: true, new: true }
  );
  if (!category) {
    throw new Error(`Catégorie introuvable : ${categoryId}`);
  }
  const padded = String(category.counter).padStart(6, "0");
  return `${category.prefix}${padded}`;
}
async function logAudit(params) {
  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    username: params.username,
    action: params.action,
    targetCollection: params.targetCollection,
    documentId: params.documentId,
    oldValue: params.oldValue,
    newValue: params.newValue
  });
}
const router$7 = express.Router();
router$7.use(attachActor);
router$7.get("/products", asyncHandler(async (req, res) => {
  const { search, page: page2 = "1", limit = "50", categoryId, supplierId, lowStock } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { designation: { $regex: search, $options: "i" } },
      { reference: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } }
    ];
  }
  if (categoryId) filter.categoryId = categoryId;
  if (supplierId) filter.supplierId = supplierId;
  if (lowStock === "true") {
    filter.$expr = { $lte: ["$stock", "$minStock"] };
  }
  const [data, total] = await Promise.all([
    Product.find(filter).populate("categoryId", "name prefix").populate("supplierId", "companyName").sort({ designation: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Product.countDocuments(filter)
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$7.get("/products/export/excel", asyncHandler(async (_req, res) => {
  const products = await Product.find({ isDeleted: false }).lean();
  const rows = products.map((p) => ({
    Référence: p.reference,
    "Code-barres": p.barcode || "",
    Désignation: p.designation,
    "Prix achat": p.purchasePrice,
    "Prix vente": p.salePrice,
    TVA: p.tva,
    Stock: p.stock,
    "Stock min": p.minStock,
    Unité: p.unit
  }));
  const ws = XLSX__namespace.utils.json_to_sheet(rows);
  const wb = XLSX__namespace.utils.book_new();
  XLSX__namespace.utils.book_append_sheet(wb, ws, "Produits");
  const buffer = XLSX__namespace.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=produits.xlsx");
  res.send(buffer);
}));
router$7.get("/products/barcode/:barcode", asyncHandler(async (req, res) => {
  const product = await Product.findOne({ barcode: req.params.barcode, isDeleted: false });
  if (!product) {
    sendError(res, "Produit introuvable", 404);
    return;
  }
  sendSuccess(res, product);
}));
router$7.get("/products/:id", asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).populate("categoryId", "name prefix").populate("subCategoryId", "name").populate("supplierId", "companyName");
  if (!product) {
    sendError(res, "Produit introuvable", 404);
    return;
  }
  sendSuccess(res, product);
}));
router$7.post("/products", asyncHandler(async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const categoryId = parsed.data.categoryId;
  if (!categoryId) {
    sendError(res, "Catégorie requise pour générer la référence", 400);
    return;
  }
  const reference = await getNextProductReference(categoryId);
  const productData = { ...parsed.data, reference };
  if (!productData.salePrice && productData.purchasePrice > 0 && productData.profitMargin) {
    productData.salePrice = calculateSalePrice(productData.purchasePrice, productData.profitMargin);
  } else if (!productData.salePrice) {
    productData.salePrice = productData.purchasePrice;
  }
  const product = await Product.create(productData);
  await logAudit({
    userId: getActorId(req),
    username: "system",
    action: "create",
    targetCollection: "products",
    documentId: product._id.toString(),
    newValue: product.toObject()
  });
  sendSuccess(res, product, 201);
}));
router$7.put("/products/:id", asyncHandler(async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const productId = String(req.params.id);
  const old = await Product.findById(productId);
  if (!old || old.isDeleted) {
    sendError(res, "Produit introuvable", 404);
    return;
  }
  if (parsed.data.reference && parsed.data.reference !== old.reference) {
    sendError(res, "La référence ne peut pas être modifiée", 400);
    return;
  }
  const updateData = { ...parsed.data };
  if (updateData.profitMargin !== void 0 && (updateData.purchasePrice !== void 0 || updateData.profitMargin !== void 0) && updateData.salePrice === void 0) {
    const pp = updateData.purchasePrice ?? old.purchasePrice;
    updateData.salePrice = calculateSalePrice(pp, updateData.profitMargin ?? old.profitMargin);
  } else if (updateData.purchasePrice !== void 0 && updateData.profitMargin === void 0 && updateData.salePrice === void 0) {
    updateData.salePrice = calculateSalePrice(updateData.purchasePrice, old.profitMargin);
  }
  const newCategoryId = updateData.categoryId ? String(updateData.categoryId) : void 0;
  if (newCategoryId && newCategoryId !== old.categoryId?.toString()) {
    const newRef = await getNextProductReference(newCategoryId);
    updateData.reference = newRef;
    updateData.categoryId = newCategoryId;
  }
  const product = await Product.findByIdAndUpdate(productId, updateData, { new: true });
  await logAudit({
    userId: getActorId(req),
    username: "system",
    action: "update",
    targetCollection: "products",
    documentId: productId,
    oldValue: old.toObject(),
    newValue: product.toObject()
  });
  sendSuccess(res, product);
}));
router$7.delete("/products/:id", asyncHandler(async (req, res) => {
  const productId = String(req.params.id);
  const old = await Product.findById(productId);
  if (!old) {
    sendError(res, "Produit introuvable", 404);
    return;
  }
  await Product.findByIdAndUpdate(productId, { isDeleted: true });
  await logAudit({
    userId: getActorId(req),
    username: "system",
    action: "delete",
    targetCollection: "products",
    documentId: productId,
    oldValue: old.toObject()
  });
  sendSuccess(res, { message: "Produit supprimé" });
}));
router$7.post("/products/import", asyncHandler(async (req, res) => {
  const { rows } = req.body;
  if (!rows?.length) {
    sendError(res, "Fichier vide", 400);
    return;
  }
  let imported = 0;
  for (const row of rows) {
    const categoryName = String(row.catégorie || row.Catégorie || row.category || "");
    let categoryId = row.categoryId;
    if (!categoryId && categoryName) {
      const cat = await Category.findOne({
        $or: [
          { name: { $regex: `^${categoryName}$`, $options: "i" } },
          { prefix: { $regex: `^${categoryName}$`, $options: "i" } }
        ]
      });
      if (cat) categoryId = cat._id.toString();
    }
    if (!categoryId) {
      const firstCat = await Category.findOne();
      if (firstCat) categoryId = firstCat._id.toString();
      else continue;
    }
    const reference = await getNextProductReference(categoryId);
    await Product.create({
      reference,
      categoryId,
      designation: String(row.designation || row.Désignation || ""),
      barcode: row.barcode || row["Code-barres"] ? String(row.barcode || row["Code-barres"]) : void 0,
      purchasePrice: Number(row.purchasePrice || row["Prix achat"] || 0),
      salePrice: Number(row.salePrice || row["Prix vente"] || 0),
      tva: Number(row.tva || row.TVA || 19),
      stock: Number(row.stock || row.Stock || 0),
      minStock: Number(row.minStock || row["Stock min"] || 0),
      unit: String(row.unit || row.Unité || "pièce")
    });
    imported++;
  }
  sendSuccess(res, { imported });
}));
router$7.get("/categories", asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  sendSuccess(res, categories);
}));
router$7.post("/categories", asyncHandler(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const category = await Category.create(parsed.data);
  sendSuccess(res, category, 201);
}));
router$7.put("/categories/:id", asyncHandler(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const category = await Category.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  sendSuccess(res, category);
}));
router$7.delete("/categories/:id", asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  await SubCategory.deleteMany({ categoryId: req.params.id });
  sendSuccess(res, { message: "Catégorie supprimée" });
}));
router$7.get("/subcategories", asyncHandler(async (req, res) => {
  const filter = req.query.categoryId ? { categoryId: req.query.categoryId } : {};
  const subcategories = await SubCategory.find(filter).populate("categoryId", "name").sort({ name: 1 });
  sendSuccess(res, subcategories);
}));
router$7.post("/subcategories", asyncHandler(async (req, res) => {
  const parsed = subCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const sub = await SubCategory.create(parsed.data);
  sendSuccess(res, sub, 201);
}));
router$7.put("/subcategories/:id", asyncHandler(async (req, res) => {
  const parsed = subCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const sub = await SubCategory.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  sendSuccess(res, sub);
}));
router$7.delete("/subcategories/:id", asyncHandler(async (req, res) => {
  await SubCategory.findByIdAndDelete(req.params.id);
  sendSuccess(res, { message: "Sous-catégorie supprimée" });
}));
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function findOrCreateCustomerByName(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await Customer.findOne({
    isDeleted: false,
    name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") }
  });
  if (existing) return { customer: existing, created: false };
  const reference = await getNextReference("customer");
  const customer = await Customer.create({ name: trimmed, reference });
  return { customer, created: true };
}
async function convertPurchaseSlipToInvoice(slip) {
  if (slip.convertedInvoiceId) {
    const existing = await Invoice.findById(slip.convertedInvoiceId);
    if (existing) return existing;
  }
  const sale = await Sale.findById(slip.saleId);
  if (!sale) {
    throw new Error("Vente introuvable pour ce bon d'achat");
  }
  const timbre = TIMBRE_FISCAL_AMOUNT;
  const totalTTC = roundMoney(slip.totalTTC + timbre);
  const invoiceRef = await getNextReference("invoice", true);
  const invoice = await Invoice.create({
    reference: invoiceRef,
    saleId: slip.saleId,
    customerId: slip.customerId,
    customerName: slip.customerName,
    lines: slip.lines,
    totalHT: slip.totalHT,
    totalTVA: slip.totalTVA,
    totalFodec: slip.totalFodec ?? 0,
    timbreFiscal: timbre,
    totalTTC,
    amountPaid: totalTTC,
    amountDue: 0,
    isPaid: true,
    includeTva: slip.includeTva ?? false
  });
  slip.amountPaid = slip.totalTTC;
  slip.amountDue = 0;
  slip.isSettled = true;
  slip.convertedInvoiceId = invoice._id;
  await slip.save();
  sale.invoiceId = invoice._id;
  await sale.save();
  return invoice;
}
function getSlipMaxPayment(slip) {
  if (slip.convertedInvoiceId) return 0;
  const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid));
  if (productDue > 0) {
    return roundMoney(productDue + TIMBRE_FISCAL_AMOUNT);
  }
  return roundMoney(slip.amountDue);
}
function isSlipAwaitingTimbre(slip) {
  if (slip.convertedInvoiceId) return false;
  return slip.amountPaid >= slip.totalTTC && slip.amountDue > 0;
}
async function applyPaymentToPurchaseSlip(slip, amount) {
  if (slip.convertedInvoiceId) {
    throw new Error("Ce bon a déjà été converti en facture");
  }
  let remaining = roundMoney(amount);
  const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid));
  if (productDue > 0 && remaining > 0) {
    const applied = roundMoney(Math.min(remaining, productDue));
    slip.amountPaid = roundMoney(slip.amountPaid + applied);
    remaining = roundMoney(remaining - applied);
    slip.amountDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid));
  }
  if (slip.amountPaid >= slip.totalTTC && !slip.convertedInvoiceId) {
    if (slip.amountDue <= 0) {
      slip.amountDue = TIMBRE_FISCAL_AMOUNT;
      slip.isSettled = false;
    }
    if (remaining > 0) {
      const timbrePay = roundMoney(Math.min(remaining, slip.amountDue));
      slip.amountDue = roundMoney(slip.amountDue - timbrePay);
      remaining = roundMoney(remaining - timbrePay);
    }
    if (slip.amountDue <= 0) {
      return convertPurchaseSlipToInvoice(slip);
    }
    await slip.save();
    return null;
  }
  slip.isSettled = slip.amountDue <= 0;
  await slip.save();
  return null;
}
const router$6 = express.Router();
router$6.use(attachActor);
router$6.get("/customers", asyncHandler(async (req, res) => {
  const { search, page: page2 = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { reference: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } }
    ];
  }
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Customer.countDocuments(filter)
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$6.get("/customers/credits/open", asyncHandler(async (_req, res) => {
  const slips = await PurchaseSlip.find({ isSettled: false, amountDue: { $gt: 0 }, convertedInvoiceId: null }).populate("customerId", "name reference phone").sort({ createdAt: -1 });
  const rows = slips.map((slip) => {
    const customer = slip.customerId;
    return {
      _id: slip._id.toString(),
      reference: slip.reference,
      customerName: slip.customerName || customer?.name || "Client",
      customerId: customer && "_id" in customer ? String(customer._id) : slip.customerId?.toString(),
      amountDue: slip.amountDue,
      documentType: "purchase_slip"
    };
  });
  sendSuccess(res, rows);
}));
router$6.post("/customers/quick", asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    sendError(res, "Nom du client requis", 400);
    return;
  }
  const result = await findOrCreateCustomerByName(name);
  if (!result) {
    sendError(res, "Nom du client requis", 400);
    return;
  }
  sendSuccess(res, { ...result.customer.toObject(), created: result.created }, result.created ? 201 : 200);
}));
router$6.get("/customers/:id", asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false });
  if (!customer) {
    sendError(res, "Client introuvable", 404);
    return;
  }
  sendSuccess(res, customer);
}));
router$6.post("/customers", asyncHandler(async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const reference = await getNextReference("customer");
  const customer = await Customer.create({ ...parsed.data, reference });
  sendSuccess(res, customer, 201);
}));
router$6.put("/customers/:id", asyncHandler(async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const customer = await Customer.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  sendSuccess(res, customer);
}));
router$6.delete("/customers/:id", asyncHandler(async (req, res) => {
  await Customer.findByIdAndUpdate(req.params.id, { isDeleted: true });
  sendSuccess(res, { message: "Client supprimé" });
}));
router$6.get("/customers/:id/sales", asyncHandler(async (req, res) => {
  const sales = await Sale.find({ customerId: req.params.id, isCancelled: false }).sort({ createdAt: -1 });
  sendSuccess(res, sales);
}));
router$6.get("/customers/:id/invoices", asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ customerId: req.params.id }).sort({ createdAt: -1 });
  sendSuccess(res, invoices);
}));
router$6.post("/customer-payments", asyncHandler(async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const customer = await Customer.findById(parsed.data.entityId);
  if (!customer || customer.isDeleted) {
    sendError(res, "Client introuvable", 404);
    return;
  }
  const amount = roundMoney(parsed.data.amount);
  let createdInvoice = null;
  let targetSlip = null;
  if (parsed.data.purchaseSlipId) {
    targetSlip = await PurchaseSlip.findById(parsed.data.purchaseSlipId);
    if (!targetSlip) {
      sendError(res, "Bon d'achat introuvable", 404);
      return;
    }
    if (targetSlip.convertedInvoiceId) {
      sendError(res, "Ce bon a déjà été converti en facture", 400);
      return;
    }
    if (targetSlip.customerId?.toString() !== parsed.data.entityId) {
      sendError(res, "Ce bon n'appartient pas à ce client", 400);
      return;
    }
    const maxPay = getSlipMaxPayment(targetSlip);
    if (amount > maxPay) {
      sendError(res, `Montant maximum pour ce bon : ${maxPay.toFixed(3)} DT`, 400);
      return;
    }
    const productDue = roundMoney(Math.max(0, targetSlip.totalTTC - targetSlip.amountPaid));
    const productPortion = roundMoney(Math.min(amount, productDue));
    if (productPortion > customer.creditBalance) {
      sendError(res, `Montant supérieur au solde crédit (${customer.creditBalance.toFixed(3)} DT)`, 400);
      return;
    }
  } else {
    const openSlips = await PurchaseSlip.find({
      customerId: parsed.data.entityId,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 });
    const maxTotal = roundMoney(openSlips.reduce((s, slip) => s + getSlipMaxPayment(slip), 0));
    if (amount > maxTotal) {
      sendError(res, `Montant maximum pour ce client : ${maxTotal.toFixed(3)} DT`, 400);
      return;
    }
    let productPortionTotal = 0;
    let remainingCheck = amount;
    for (const slip of openSlips) {
      if (remainingCheck <= 0) break;
      const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid));
      const applied = roundMoney(Math.min(remainingCheck, getSlipMaxPayment(slip)));
      productPortionTotal = roundMoney(productPortionTotal + Math.min(applied, productDue));
      remainingCheck = roundMoney(remainingCheck - applied);
    }
    if (productPortionTotal > customer.creditBalance) {
      sendError(res, `Montant supérieur au solde crédit (${customer.creditBalance.toFixed(3)} DT)`, 400);
      return;
    }
  }
  const payment = await Payment.create({
    ...parsed.data,
    amount,
    createdBy: getActorId(req)
  });
  let creditReduction = 0;
  if (targetSlip) {
    creditReduction = roundMoney(Math.min(amount, roundMoney(Math.max(0, targetSlip.totalTTC - targetSlip.amountPaid))));
  } else {
    let remaining = amount;
    const openSlipsForCredit = await PurchaseSlip.find({
      customerId: parsed.data.entityId,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 });
    for (const slip of openSlipsForCredit) {
      if (remaining <= 0) break;
      const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid));
      const applied = roundMoney(Math.min(remaining, getSlipMaxPayment(slip)));
      creditReduction = roundMoney(creditReduction + Math.min(applied, productDue));
      remaining = roundMoney(remaining - applied);
    }
  }
  customer.creditBalance = roundMoney(Math.max(0, customer.creditBalance - creditReduction));
  await customer.save();
  if (parsed.data.invoiceId) {
    const invoice = await Invoice.findById(parsed.data.invoiceId);
    if (invoice) {
      invoice.amountPaid = roundMoney(invoice.amountPaid + amount);
      invoice.amountDue = Math.max(0, roundMoney(invoice.totalTTC - invoice.amountPaid));
      invoice.isPaid = invoice.amountDue <= 0;
      await invoice.save();
    }
  }
  if (targetSlip) {
    createdInvoice = await applyPaymentToPurchaseSlip(targetSlip, amount);
  } else if (amount > 0) {
    let remaining = amount;
    const openSlips = await PurchaseSlip.find({
      customerId: parsed.data.entityId,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 });
    for (const slip of openSlips) {
      if (remaining <= 0) break;
      const maxPay = getSlipMaxPayment(slip);
      const applied = roundMoney(Math.min(remaining, maxPay));
      if (applied <= 0) continue;
      const invoice = await applyPaymentToPurchaseSlip(slip, applied);
      if (invoice) createdInvoice = invoice;
      remaining = roundMoney(remaining - applied);
    }
  }
  sendSuccess(res, { payment, invoice: createdInvoice }, 201);
}));
const router$5 = express.Router();
router$5.use(attachActor);
function calcReceiveBatchHT(orderLines, receiveLines) {
  return roundMoney(
    receiveLines.reduce((sum, rl) => {
      if (rl.quantity <= 0) return sum;
      const ol = orderLines.find((l) => l.productId.toString() === rl.productId);
      if (!ol) return sum;
      return sum + rl.quantity * ol.unitPrice;
    }, 0)
  );
}
async function applyReceivePayment(order, batchHT, payment, actorId) {
  if (batchHT <= 0) return;
  let payAmount = 0;
  let debtAmount = 0;
  if (payment.mode === "paid") {
    payAmount = batchHT;
  } else if (payment.mode === "credit") {
    debtAmount = batchHT;
  } else {
    payAmount = roundMoney(Math.min(payment.amountPaid ?? 0, batchHT));
    debtAmount = roundMoney(batchHT - payAmount);
  }
  order.amountPaid = roundMoney((order.amountPaid || 0) + payAmount);
  const computed = computePurchasePayment(order.lines, order.amountPaid);
  order.paymentStatus = computed.paymentStatus;
  order.amountDue = computed.amountDue;
  await order.save();
  if (debtAmount > 0) {
    await Supplier.findByIdAndUpdate(order.supplierId, { $inc: { balance: debtAmount } });
    await SupplierInvoice.create({
      supplierId: order.supplierId,
      purchaseOrderId: order._id,
      reference: `DET-${order.reference}`,
      amount: debtAmount
    });
  }
  if (payAmount > 0) {
    await Payment.create({
      type: "supplier",
      entityId: order.supplierId,
      purchaseOrderId: order._id,
      amount: payAmount,
      method: payment.method || "cash",
      createdBy: actorId
    });
  }
}
async function applyPurchaseReceive(order, lines, actorId, options) {
  const receiptRef = await getNextReference("purchaseReceipt");
  const updatedProducts = [];
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const orderLine = order.lines.find((l) => l.productId.toString() === line.productId);
    if (!orderLine) continue;
    const remaining = orderLine.quantity - orderLine.receivedQuantity;
    if (line.quantity > remaining) {
      throw new Error(
        `Quantité excessive pour « ${orderLine.designation} » (reste: ${remaining})`
      );
    }
    orderLine.receivedQuantity += line.quantity;
    const product = await Product.findById(line.productId);
    if (!product) continue;
    const stockBefore = product.stock;
    product.stock += line.quantity;
    if (options?.updatePurchasePrices) {
      const price = line.unitPrice ?? orderLine.unitPrice;
      if (price > 0) product.purchasePrice = price;
    }
    await product.save();
    updatedProducts.push({ productId: product._id.toString(), stockBefore });
    await StockMovement.create({
      productId: product._id,
      type: "in",
      reason: "purchase",
      quantity: line.quantity,
      stockBefore,
      stockAfter: product.stock,
      reference: receiptRef,
      createdBy: actorId
    });
  }
  const allReceived = order.lines.every((l) => l.receivedQuantity >= l.quantity);
  const partialReceived = order.lines.some((l) => l.receivedQuantity > 0);
  order.status = allReceived ? "received" : partialReceived ? "partial" : order.status;
  await order.save();
  const receipt = await PurchaseReceipt.create({
    purchaseOrderId: order._id,
    reference: receiptRef,
    lines: lines.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, quantity: l.quantity })),
    receivedBy: actorId
  });
  return { order, receipt, updatedProducts, receiptRef };
}
router$5.get("/suppliers", asyncHandler(async (req, res) => {
  const { search, page: page2 = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { companyName: { $regex: search, $options: "i" } },
      { reference: { $regex: search, $options: "i" } }
    ];
  }
  const [data, total] = await Promise.all([
    Supplier.find(filter).sort({ companyName: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Supplier.countDocuments(filter)
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$5.get("/suppliers/:id", asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, isDeleted: false });
  if (!supplier) {
    sendError(res, "Fournisseur introuvable", 404);
    return;
  }
  sendSuccess(res, supplier);
}));
router$5.post("/suppliers", asyncHandler(async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const reference = await getNextReference("supplier");
  const supplier = await Supplier.create({ ...parsed.data, reference });
  sendSuccess(res, supplier, 201);
}));
router$5.put("/suppliers/:id", asyncHandler(async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  sendSuccess(res, supplier);
}));
router$5.delete("/suppliers/:id", asyncHandler(async (req, res) => {
  await Supplier.findByIdAndUpdate(req.params.id, { isDeleted: true });
  sendSuccess(res, { message: "Fournisseur supprimé" });
}));
router$5.get("/suppliers/:id/purchases", asyncHandler(async (req, res) => {
  const orders = await PurchaseOrder.find({ supplierId: req.params.id }).sort({ createdAt: -1 });
  sendSuccess(res, orders);
}));
router$5.get("/suppliers/:id/payments", asyncHandler(async (req, res) => {
  const payments = await Payment.find({ type: "supplier", entityId: req.params.id }).sort({ createdAt: -1 });
  sendSuccess(res, payments);
}));
router$5.get("/suppliers/:id/activity", asyncHandler(async (req, res) => {
  const supplierId = req.params.id;
  const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
  if (!supplier) {
    sendError(res, "Fournisseur introuvable", 404);
    return;
  }
  const [orders, payments, supplierInvoices, products] = await Promise.all([
    PurchaseOrder.find({ supplierId }).sort({ createdAt: -1 }),
    Payment.find({ type: "supplier", entityId: supplierId }).sort({ createdAt: -1 }),
    SupplierInvoice.find({ supplierId }).sort({ createdAt: -1 }),
    Product.find({ supplierId, isDeleted: false }).select("reference designation purchasePrice stock unit").sort({ designation: 1 })
  ]);
  const orderIds = orders.map((o) => o._id);
  const orderRefMap = new Map(orders.map((o) => [o._id.toString(), o.reference]));
  const receipts = orderIds.length ? await PurchaseReceipt.find({ purchaseOrderId: { $in: orderIds } }).sort({ createdAt: -1 }).lean() : [];
  const productIds = /* @__PURE__ */ new Set();
  for (const o of orders) {
    for (const l of o.lines) productIds.add(l.productId.toString());
  }
  for (const r of receipts) {
    for (const l of r.lines) productIds.add(l.productId.toString());
  }
  const productMap = new Map(
    products.map((p) => [p._id.toString(), p])
  );
  const extraProducts = productIds.size > 0 ? await Product.find({
    _id: { $in: [...productIds].filter((id) => !productMap.has(id)) },
    isDeleted: false
  }).select("reference designation purchasePrice stock unit").lean() : [];
  for (const p of extraProducts) {
    productMap.set(p._id.toString(), p);
  }
  const activities = [];
  for (const order of orders) {
    activities.push({
      _id: order._id.toString(),
      date: order.createdAt,
      type: "order",
      reference: order.reference,
      label: `Bon de commande — ${order.lines.length} ligne(s)`,
      amount: order.totalHT,
      effect: "neutral",
      status: order.status,
      lines: order.lines.map((l) => ({
        designation: l.designation,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        receivedQuantity: l.receivedQuantity
      })),
      paymentStatus: order.paymentStatus,
      amountPaid: order.amountPaid,
      amountDue: order.amountDue
    });
  }
  for (const receipt of receipts) {
    const poRef = orderRefMap.get(receipt.purchaseOrderId.toString()) ?? "—";
    const recvLines = receipt.lines.map((l) => {
      const p = productMap.get(l.productId.toString());
      return {
        designation: p?.designation ?? "Produit",
        quantity: l.quantity
      };
    });
    const totalQty = recvLines.reduce((s, l) => s + (l.quantity ?? 0), 0);
    activities.push({
      _id: receipt._id.toString(),
      date: receipt.createdAt,
      type: "receipt",
      reference: receipt.reference,
      label: `Réception BC ${poRef} — ${totalQty} unité(s)`,
      effect: "neutral",
      lines: recvLines
    });
  }
  for (const inv of supplierInvoices) {
    const poRef = inv.purchaseOrderId ? orderRefMap.get(inv.purchaseOrderId.toString()) : void 0;
    activities.push({
      _id: inv._id.toString(),
      date: inv.createdAt,
      type: "invoice",
      reference: inv.reference,
      label: poRef ? `Facture fournisseur (BC ${poRef})` : "Facture fournisseur",
      amount: inv.amount,
      effect: "debt_up"
    });
  }
  for (const pay of payments) {
    activities.push({
      _id: pay._id.toString(),
      date: pay.createdAt,
      type: "payment",
      reference: `PAY-${pay._id.toString().slice(-6).toUpperCase()}`,
      label: "Paiement fournisseur",
      amount: pay.amount,
      effect: "debt_down",
      method: pay.method,
      notes: pay.notes
    });
  }
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalOrdersHT = roundMoney(orders.reduce((s, o) => s + o.totalHT, 0));
  const totalInvoiced = roundMoney(supplierInvoices.reduce((s, i) => s + i.amount, 0));
  const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  sendSuccess(res, {
    supplier,
    summary: {
      balance: supplier.balance,
      totalOrdersHT,
      totalInvoiced,
      totalPaid,
      ordersCount: orders.length,
      receiptsCount: receipts.length,
      invoicesCount: supplierInvoices.length,
      paymentsCount: payments.length,
      productsCount: products.length
    },
    activities,
    products: products.map((p) => ({
      _id: p._id.toString(),
      reference: p.reference,
      designation: p.designation,
      purchasePrice: p.purchasePrice,
      stock: p.stock,
      unit: p.unit
    }))
  });
}));
router$5.get("/purchase-orders", asyncHandler(async (req, res) => {
  const { status, page: page2 = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = {};
  if (status) filter.status = status;
  const [data, total] = await Promise.all([
    PurchaseOrder.find(filter).populate("supplierId", "companyName reference").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    PurchaseOrder.countDocuments(filter)
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$5.post("/purchase-orders/quick-receive", asyncHandler(async (req, res) => {
  const parsed = quickReceiveSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const { supplierId, lines, notes, updatePurchasePrices, recordDebt } = parsed.data;
  const reference = await getNextReference("purchaseOrder", true);
  const totalHT = roundMoney(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const order = await PurchaseOrder.create({
    reference,
    supplierId,
    lines: lines.map((l) => ({ ...l, receivedQuantity: 0 })),
    totalHT,
    notes,
    status: "sent"
  });
  try {
    const { order: updatedOrder, receipt } = await applyPurchaseReceive(
      order,
      lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
      getActorId(req),
      { updatePurchasePrices }
    );
    if (recordDebt && totalHT > 0) {
      await applyReceivePayment(
        updatedOrder,
        totalHT,
        { mode: "credit" },
        getActorId(req)
      );
    } else {
      await applyReceivePayment(
        updatedOrder,
        totalHT,
        { mode: "paid", method: "cash" },
        getActorId(req)
      );
    }
    const freshOrder = await PurchaseOrder.findById(updatedOrder._id);
    sendSuccess(res, { order: freshOrder, receipt, totalHT }, 201);
  } catch (err) {
    await PurchaseOrder.findByIdAndDelete(order._id);
    sendError(res, err instanceof Error ? err.message : "Erreur réception", 400);
  }
}));
router$5.post("/purchase-orders", asyncHandler(async (req, res) => {
  const parsed = purchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const reference = await getNextReference("purchaseOrder", true);
  const totalHT = roundMoney(parsed.data.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const order = await PurchaseOrder.create({
    reference,
    supplierId: parsed.data.supplierId,
    lines: parsed.data.lines.map((l) => ({ ...l, receivedQuantity: 0 })),
    totalHT,
    notes: parsed.data.notes,
    status: "draft"
  });
  sendSuccess(res, order, 201);
}));
router$5.put("/purchase-orders/:id/status", asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status }, { new: true });
  sendSuccess(res, order);
}));
router$5.post("/purchase-orders/:id/receive", asyncHandler(async (req, res) => {
  const { lines, updatePurchasePrices, payment } = req.body;
  const paymentParsed = purchaseReceivePaymentSchema.safeParse(
    payment ?? { mode: "credit" }
  );
  if (!paymentParsed.success) {
    handleZodError(res, paymentParsed.error);
    return;
  }
  const order = await PurchaseOrder.findById(req.params.id);
  if (!order) {
    sendError(res, "Bon de commande introuvable", 404);
    return;
  }
  const batchHT = calcReceiveBatchHT(order.lines, lines);
  const originalReceived = order.lines.map((l) => ({
    productId: l.productId.toString(),
    receivedQuantity: l.receivedQuantity
  }));
  const originalStatus = order.status;
  const originalAmountPaid = order.amountPaid;
  const originalPaymentStatus = order.paymentStatus;
  const originalAmountDue = order.amountDue;
  let updatedProducts = [];
  try {
    const priceMap = new Map(
      order.lines.map((l) => [l.productId.toString(), l.unitPrice])
    );
    const receiveLines = lines.map((l) => ({
      ...l,
      unitPrice: l.unitPrice ?? priceMap.get(l.productId)
    }));
    const result = await applyPurchaseReceive(order, receiveLines, getActorId(req), {
      updatePurchasePrices
    });
    updatedProducts = result.updatedProducts;
    await applyReceivePayment(
      result.order,
      batchHT,
      paymentParsed.data,
      getActorId(req)
    );
    const freshOrder = await PurchaseOrder.findById(result.order._id);
    sendSuccess(res, { order: freshOrder, receipt: result.receipt });
  } catch (err) {
    try {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId);
        if (prod) {
          prod.stock = upd.stockBefore;
          await prod.save();
        }
      }
      for (const ov of originalReceived) {
        const ol = order.lines.find((l) => l.productId.toString() === ov.productId);
        if (ol) ol.receivedQuantity = ov.receivedQuantity;
      }
      order.status = originalStatus;
      order.amountPaid = originalAmountPaid;
      order.paymentStatus = originalPaymentStatus;
      order.amountDue = originalAmountDue;
      await order.save();
    } catch {
    }
    sendError(res, err instanceof Error ? err.message : "Erreur réception", 400);
  }
}));
router$5.post("/purchase-orders/:id/pay", asyncHandler(async (req, res) => {
  const parsed = purchaseOrderPaySchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const order = await PurchaseOrder.findById(req.params.id);
  if (!order) {
    sendError(res, "Bon de commande introuvable", 404);
    return;
  }
  const computed = computePurchasePayment(order.lines, order.amountPaid || 0);
  const amount = roundMoney(parsed.data.amount);
  if (computed.amountDue <= 0) {
    sendError(res, "Ce bon de commande est déjà payé", 400);
    return;
  }
  if (amount > computed.amountDue) {
    sendError(res, `Montant supérieur au reste dû (${computed.amountDue.toFixed(3)} DT)`, 400);
    return;
  }
  const supplier = await Supplier.findById(order.supplierId);
  if (!supplier || supplier.isDeleted) {
    sendError(res, "Fournisseur introuvable", 404);
    return;
  }
  order.amountPaid = roundMoney((order.amountPaid || 0) + amount);
  const updated = computePurchasePayment(order.lines, order.amountPaid);
  order.paymentStatus = updated.paymentStatus;
  order.amountDue = updated.amountDue;
  await order.save();
  supplier.balance = roundMoney(Math.max(0, supplier.balance - amount));
  await supplier.save();
  const payment = await Payment.create({
    type: "supplier",
    entityId: order.supplierId,
    purchaseOrderId: order._id,
    amount,
    method: parsed.data.method,
    notes: parsed.data.notes,
    createdBy: getActorId(req)
  });
  sendSuccess(res, { order, payment }, 201);
}));
router$5.post("/supplier-invoices", asyncHandler(async (req, res) => {
  const { supplierId, purchaseOrderId, reference, amount, filePath, fileType } = req.body;
  const invoice = await SupplierInvoice.create({
    supplierId,
    purchaseOrderId,
    reference,
    amount,
    filePath,
    fileType
  });
  await Supplier.findByIdAndUpdate(supplierId, { $inc: { balance: amount } });
  sendSuccess(res, invoice, 201);
}));
router$5.post("/supplier-payments", asyncHandler(async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  if (parsed.data.type !== "supplier") {
    sendError(res, "Type de paiement invalide", 400);
    return;
  }
  const supplier = await Supplier.findById(parsed.data.entityId);
  if (!supplier || supplier.isDeleted) {
    sendError(res, "Fournisseur introuvable", 404);
    return;
  }
  const amount = roundMoney(parsed.data.amount);
  if (amount > supplier.balance) {
    sendError(res, `Montant supérieur à la dette (${supplier.balance.toFixed(3)} DT)`, 400);
    return;
  }
  const payment = await Payment.create({
    ...parsed.data,
    amount,
    createdBy: getActorId(req)
  });
  supplier.balance = roundMoney(Math.max(0, supplier.balance - amount));
  await supplier.save();
  sendSuccess(res, payment, 201);
}));
const router$4 = express.Router();
router$4.use(attachActor);
router$4.post("/sales", asyncHandler(async (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const includeTva = parsed.data.includeTva ?? false;
  const saleLines = [];
  let totalHT = 0;
  let totalTVA = 0;
  let fodecBaseHT = 0;
  const updatedProducts = [];
  try {
    for (const line of parsed.data.lines) {
      const product = await Product.findById(line.productId);
      if (!product || product.isDeleted) {
        for (const upd of updatedProducts) {
          const prod = await Product.findById(upd.productId);
          if (prod) {
            prod.stock = upd.stockBefore;
            await prod.save();
          }
        }
        sendError(res, `Produit introuvable: ${line.productId}`, 400);
        return;
      }
      if (product.stock < line.quantity) {
        for (const upd of updatedProducts) {
          const prod = await Product.findById(upd.productId);
          if (prod) {
            prod.stock = upd.stockBefore;
            await prod.save();
          }
        }
        sendError(res, `Stock insuffisant pour ${product.designation}`, 400);
        return;
      }
      const discountPercent = line.discount !== void 0 ? line.discount : product.discount || 0;
      const unitPrice = product.salePrice;
      const lineTotalBeforeDiscount = roundMoney(unitPrice * line.quantity);
      const lineHT = applyDiscount(lineTotalBeforeDiscount, discountPercent);
      const lineTVA = includeTva ? calculateTVA(lineHT, product.tva) : 0;
      const lineTTC = roundMoney(lineHT + lineTVA);
      saleLines.push({
        productId: product._id.toString(),
        reference: product.reference,
        designation: product.designation,
        quantity: line.quantity,
        unitPrice,
        discount: discountPercent,
        tva: product.tva,
        totalHT: lineHT,
        totalTVA: lineTVA,
        totalTTC: lineTTC
      });
      totalHT += lineHT;
      totalTVA += lineTVA;
      if (product.subjectToFodec) {
        fodecBaseHT += lineHT;
      }
      const stockBefore = product.stock;
      product.stock -= line.quantity;
      await product.save();
      updatedProducts.push({ productId: product._id.toString(), stockBefore });
      await StockMovement.create({
        productId: product._id,
        type: "out",
        reason: "sale",
        quantity: line.quantity,
        stockBefore,
        stockAfter: product.stock,
        createdBy: getActorId(req)
      });
    }
    totalHT = roundMoney(totalHT);
    totalTVA = roundMoney(totalTVA);
    fodecBaseHT = roundMoney(fodecBaseHT);
    const totalFodec = calculateFodec(fodecBaseHT);
    const subtotal = roundMoney(totalHT + totalFodec + totalTVA);
    const paymentProbe = resolveSalePayment(subtotal, parsed.data.paymentMethod, {
      amountPaid: parsed.data.amountPaid,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount
    });
    const isFullPayment = paymentProbe.amountDue === 0;
    const timbreFiscal = isFullPayment ? TIMBRE_FISCAL_AMOUNT : 0;
    const totalTTC = roundMoney(subtotal + timbreFiscal);
    const payment = resolveSalePayment(totalTTC, parsed.data.paymentMethod, {
      amountPaid: parsed.data.amountPaid,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount
    });
    const { amountPaid, amountDue, change } = payment;
    let resolvedCustomerId = parsed.data.customerId || void 0;
    let resolvedCustomerName = parsed.data.customerName?.trim() || void 0;
    if (!resolvedCustomerId && resolvedCustomerName) {
      const result = await findOrCreateCustomerByName(resolvedCustomerName);
      if (result) {
        resolvedCustomerId = result.customer._id.toString();
        resolvedCustomerName = result.customer.name;
      }
    } else if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId);
      if (customer) {
        resolvedCustomerName = resolvedCustomerName || customer.name;
      }
    }
    if (amountDue > 0 && !resolvedCustomerId) {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId);
        if (prod) {
          prod.stock = upd.stockBefore;
          await prod.save();
        }
      }
      sendError(res, "Indiquez le nom du client pour enregistrer une dette", 400);
      return;
    }
    const sale = await Sale.create({
      customerId: resolvedCustomerId,
      cashierId: getActorId(req),
      lines: saleLines,
      totalHT,
      totalTVA,
      totalFodec,
      timbreFiscal,
      totalTTC,
      amountPaid,
      amountDue,
      paymentMethod: parsed.data.paymentMethod,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount,
      change,
      includeTva
    });
    let customerName = resolvedCustomerName;
    if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId);
      if (customer) {
        customerName = customer.name;
        customer.totalPurchases += totalTTC;
        if (amountDue > 0) {
          customer.creditBalance += amountDue;
        }
        await customer.save();
      }
    }
    const docPayload = {
      saleId: sale._id,
      customerId: resolvedCustomerId,
      customerName,
      lines: saleLines,
      totalHT,
      totalTVA,
      totalFodec,
      timbreFiscal,
      totalTTC,
      amountPaid,
      amountDue,
      includeTva
    };
    if (amountDue > 0) {
      const slipRef = await getNextReference("purchaseSlip", true);
      const purchaseSlip = await PurchaseSlip.create({
        reference: slipRef,
        ...docPayload,
        isSettled: false
      });
      sale.purchaseSlipId = purchaseSlip._id;
      await sale.save();
      sendSuccess(res, { sale, purchaseSlip, documentType: "purchase_slip" }, 201);
      return;
    }
    const invoiceRef = await getNextReference("invoice", true);
    const invoice = await Invoice.create({
      reference: invoiceRef,
      ...docPayload,
      isPaid: true
    });
    sale.invoiceId = invoice._id;
    await sale.save();
    sendSuccess(res, { sale, invoice, documentType: "invoice" }, 201);
  } catch (err) {
    try {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId);
        if (prod) {
          prod.stock = upd.stockBefore;
          await prod.save();
        }
      }
    } catch {
    }
    throw err;
  }
}));
router$4.get("/sales", asyncHandler(async (req, res) => {
  const { page: page2 = "1", limit = "20", date } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = { isCancelled: false };
  if (date) {
    const d = new Date(date);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }
  const [data, total] = await Promise.all([
    Sale.find(filter).populate("customerId", "name").populate("cashierId", "username").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Sale.countDocuments(filter)
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$4.post("/sales/:id/cancel", asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale || sale.isCancelled) {
    sendError(res, "Vente introuvable", 404);
    return;
  }
  const originalCancelled = sale.isCancelled;
  const updatedProducts = [];
  try {
    for (const line of sale.lines) {
      const product = await Product.findById(line.productId);
      if (!product) continue;
      const stockBefore = product.stock;
      product.stock += line.quantity;
      await product.save();
      updatedProducts.push({ productId: product._id.toString(), stockBefore });
      await StockMovement.create({
        productId: product._id,
        type: "in",
        reason: "correction",
        quantity: line.quantity,
        stockBefore,
        stockAfter: product.stock,
        reference: `ANN-${sale._id}`,
        notes: "Annulation vente",
        createdBy: getActorId(req)
      });
    }
    sale.isCancelled = true;
    await sale.save();
    if (sale.invoiceId) {
      await Invoice.findByIdAndUpdate(sale.invoiceId, { isPaid: true, amountDue: 0 });
    }
    if (sale.purchaseSlipId) {
      const slip = await PurchaseSlip.findById(sale.purchaseSlipId);
      if (slip && slip.customerId && slip.amountDue > 0) {
        await Customer.findByIdAndUpdate(slip.customerId, {
          $inc: { creditBalance: -slip.amountDue }
        });
      }
      await PurchaseSlip.findByIdAndUpdate(sale.purchaseSlipId, {
        isSettled: true,
        amountDue: 0,
        amountPaid: slip?.totalTTC ?? 0
      });
    }
    sendSuccess(res, { message: "Vente annulée" });
  } catch (err) {
    try {
      sale.isCancelled = originalCancelled;
      await sale.save();
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId);
        if (prod) {
          prod.stock = upd.stockBefore;
          await prod.save();
        }
      }
    } catch {
    }
    throw err;
  }
}));
router$4.get("/invoices", asyncHandler(async (req, res) => {
  const { page: page2 = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const [data, total] = await Promise.all([
    Invoice.find().sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Invoice.countDocuments()
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$4.get("/invoices/:id/receipt", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    sendError(res, "Facture introuvable", 404);
    return;
  }
  const settings = await Settings.findOne() ?? await Settings.create({});
  const receiptData = generateReceiptEscPos(invoice, settings);
  sendSuccess(res, { data: receiptData.toString("base64") });
}));
router$4.get("/invoices/:id", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate("customerId", "name phone address");
  if (!invoice) {
    sendError(res, "Facture introuvable", 404);
    return;
  }
  sendSuccess(res, invoice);
}));
router$4.patch("/invoices/:id", asyncHandler(async (req, res) => {
  const parsed = updateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const invoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    { customerName: parsed.data.customerName.trim() },
    { new: true }
  );
  if (!invoice) {
    sendError(res, "Facture introuvable", 404);
    return;
  }
  sendSuccess(res, invoice);
}));
router$4.get("/purchase-slips", asyncHandler(async (req, res) => {
  const { page: page2 = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const [data, total] = await Promise.all([
    PurchaseSlip.find().sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    PurchaseSlip.countDocuments()
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$4.get("/purchase-slips/:id", asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findById(req.params.id).populate("customerId", "name phone");
  if (!slip) {
    sendError(res, "Bon d'achat introuvable", 404);
    return;
  }
  sendSuccess(res, slip);
}));
router$4.get("/purchase-slips/:id/receipt", asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findById(req.params.id);
  if (!slip) {
    sendError(res, "Bon d'achat introuvable", 404);
    return;
  }
  const settings = await Settings.findOne() ?? await Settings.create({});
  const receiptData = generatePurchaseSlipEscPos(slip, settings);
  sendSuccess(res, { data: receiptData.toString("base64") });
}));
const router$3 = express.Router();
router$3.use(attachActor);
router$3.get("/stock/movements", asyncHandler(async (req, res) => {
  const { productId, page: page2 = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = {};
  if (productId) filter.productId = productId;
  const [data, total] = await Promise.all([
    StockMovement.find(filter).populate("productId", "reference designation").populate("createdBy", "username").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    StockMovement.countDocuments(filter)
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router$3.get("/stock/valuation", asyncHandler(async (_req, res) => {
  const products = await Product.find({ isDeleted: false });
  const valuation = products.reduce((sum, p) => sum + p.stock * p.purchasePrice, 0);
  const saleValue = products.reduce((sum, p) => sum + p.stock * p.salePrice, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  sendSuccess(res, {
    totalProducts: products.length,
    purchaseValue: Math.round(valuation * 1e3) / 1e3,
    saleValue: Math.round(saleValue * 1e3) / 1e3,
    lowStockProducts: lowStock
  });
}));
router$3.get("/stock/alerts", asyncHandler(async (_req, res) => {
  const products = await Product.find({
    isDeleted: false,
    $expr: { $lte: ["$stock", "$minStock"] }
  }).sort({ stock: 1 });
  sendSuccess(res, products);
}));
router$3.post("/stock/adjust", asyncHandler(async (req, res) => {
  const { productId, quantity, notes } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    sendError(res, "Produit introuvable", 404);
    return;
  }
  const stockBefore = product.stock;
  product.stock = quantity;
  await product.save();
  const diff = quantity - stockBefore;
  await StockMovement.create({
    productId: product._id,
    type: diff >= 0 ? "in" : "out",
    reason: "correction",
    quantity: Math.abs(diff),
    stockBefore,
    stockAfter: product.stock,
    notes,
    createdBy: getActorId(req)
  });
  sendSuccess(res, product);
}));
router$3.post("/inventory", asyncHandler(async (req, res) => {
  const { lines, notes } = req.body;
  const reference = await getNextReference("inventory");
  const adjustmentLines = [];
  const updatedProducts = [];
  try {
    for (const line of lines) {
      const product = await Product.findById(line.productId);
      if (!product) continue;
      const theoreticalStock = product.stock;
      const difference = line.actualStock - theoreticalStock;
      adjustmentLines.push({
        productId: product._id.toString(),
        designation: product.designation,
        theoreticalStock,
        actualStock: line.actualStock,
        difference
      });
      if (difference !== 0) {
        const stockBefore = product.stock;
        product.stock = line.actualStock;
        await product.save();
        updatedProducts.push({ productId: product._id.toString(), stockBefore });
        await StockMovement.create({
          productId: product._id,
          type: difference > 0 ? "in" : "out",
          reason: "inventory",
          quantity: Math.abs(difference),
          stockBefore,
          stockAfter: product.stock,
          reference,
          createdBy: getActorId(req)
        });
      }
    }
    const adjustment = await InventoryAdjustment.create({
      reference,
      lines: adjustmentLines,
      notes,
      createdBy: getActorId(req)
    });
    sendSuccess(res, adjustment, 201);
  } catch (err) {
    try {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId);
        if (prod) {
          prod.stock = upd.stockBefore;
          await prod.save();
        }
      }
    } catch {
    }
    throw err;
  }
}));
router$3.get("/inventory", asyncHandler(async (req, res) => {
  const { page: page2 = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const [data, total] = await Promise.all([
    InventoryAdjustment.find().populate("createdBy", "username").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    InventoryAdjustment.countDocuments()
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
const router$2 = express.Router();
router$2.use(attachActor);
router$2.get("/dashboard", asyncHandler(async (_req, res) => {
  const { start, end } = getDayBounds();
  const todaySales = await Sale.find({
    isCancelled: false,
    createdAt: { $gte: start, $lte: end }
  });
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalTTC, 0);
  const productIds = todaySales.flatMap((s) => s.lines.map((l) => l.productId));
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  let profit = 0;
  for (const sale of todaySales) {
    for (const line of sale.lines) {
      const product = productMap.get(line.productId.toString());
      if (product) {
        profit += line.totalHT - product.purchasePrice * line.quantity;
      }
    }
  }
  const todayInvoices = await Invoice.countDocuments({ createdAt: { $gte: start, $lte: end } });
  const lowStockCount = await Product.countDocuments({
    isDeleted: false,
    $expr: { $lte: ["$stock", "$minStock"] }
  });
  const recentPurchases = await PurchaseOrder.find().populate("supplierId", "companyName").sort({ createdAt: -1 }).limit(5);
  const recentCustomers = await Customer.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5);
  const sixMonthsAgo = /* @__PURE__ */ new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlySalesData = await Sale.aggregate([
    { $match: { isCancelled: false, createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        revenue: { $sum: "$totalTTC" },
        profit: { $sum: "$totalHT" }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  const topProducts = await Sale.aggregate([
    { $match: { isCancelled: false } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.productId",
        designation: { $first: "$lines.designation" },
        quantity: { $sum: "$lines.quantity" },
        revenue: { $sum: "$lines.totalTTC" }
      }
    },
    { $sort: { quantity: -1 } },
    { $limit: 10 }
  ]);
  sendSuccess(res, {
    todayRevenue: Math.round(todayRevenue * 1e3) / 1e3,
    todaySales: todaySales.length,
    todayProfit: Math.round(profit * 1e3) / 1e3,
    todayInvoices,
    lowStockCount,
    recentPurchases,
    recentCustomers,
    topProducts: topProducts.map((p) => ({
      productId: p._id,
      designation: p.designation,
      quantity: p.quantity,
      revenue: p.revenue
    })),
    monthlySales: monthlySalesData.map((m) => ({
      month: m._id,
      revenue: m.revenue,
      profit: m.profit
    }))
  });
}));
router$2.get("/reports/sales", asyncHandler(async (req, res) => {
  const { period = "month", year, month } = req.query;
  const filter = { isCancelled: false };
  if (period === "day" && year && month) {
    const d = new Date(Number(year), Number(month) - 1, 1);
    const { start, end } = getDayBounds(d);
    filter.createdAt = { $gte: start, $lte: end };
  } else if (period === "month" && year && month) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  } else if (period === "year" && year) {
    const start = new Date(Number(year), 0, 1);
    const end = new Date(Number(year), 11, 31, 23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }
  const sales = await Sale.find(filter).sort({ createdAt: -1 });
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalTTC, 0);
  const totalHT = sales.reduce((sum, s) => sum + s.totalHT, 0);
  sendSuccess(res, { sales, totalRevenue, totalHT, count: sales.length });
}));
router$2.get("/reports/top-products", asyncHandler(async (req, res) => {
  const { limit = "10" } = req.query;
  const top = await Sale.aggregate([
    { $match: { isCancelled: false } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.productId",
        designation: { $first: "$lines.designation" },
        reference: { $first: "$lines.reference" },
        quantity: { $sum: "$lines.quantity" },
        revenue: { $sum: "$lines.totalTTC" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: parseInt(limit, 10) }
  ]);
  sendSuccess(res, top);
}));
router$2.get("/reports/top-customers", asyncHandler(async (_req, res) => {
  const top = await Customer.find({ isDeleted: false }).sort({ totalPurchases: -1 }).limit(10).select("name reference totalPurchases creditBalance");
  sendSuccess(res, top);
}));
router$2.get("/reports/top-suppliers", asyncHandler(async (_req, res) => {
  const top = await PurchaseOrder.aggregate([
    { $group: { _id: "$supplierId", count: { $sum: 1 }, total: { $sum: "$totalHT" } } },
    { $sort: { total: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "suppliers",
        localField: "_id",
        foreignField: "_id",
        as: "supplier"
      }
    },
    { $unwind: "$supplier" }
  ]);
  sendSuccess(res, top);
}));
router$2.get("/reports/profit", asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = { isCancelled: false };
  if (year && month) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }
  const sales = await Sale.find(filter);
  const productIds = [...new Set(sales.flatMap((s) => s.lines.map((l) => l.productId.toString())))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  let revenue = 0;
  let cost = 0;
  for (const sale of sales) {
    revenue += sale.totalTTC;
    for (const line of sale.lines) {
      const product = productMap.get(line.productId.toString());
      if (product) cost += product.purchasePrice * line.quantity;
    }
  }
  sendSuccess(res, {
    revenue: Math.round(revenue * 1e3) / 1e3,
    cost: Math.round(cost * 1e3) / 1e3,
    profit: Math.round((revenue - cost) * 1e3) / 1e3
  });
}));
const router$1 = express.Router();
router$1.use(attachActor);
router$1.get("/settings", asyncHandler(async (_req, res) => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  sendSuccess(res, settings);
}));
router$1.put("/settings", asyncHandler(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const old = await Settings.findOne();
  const updateData = { ...parsed.data };
  if (!updateData.mongoUri) {
    updateData.mongoUri = old?.mongoUri ?? DEFAULT_MONGO_URI;
  }
  const settings = await Settings.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  await logAudit({
    userId: getActorId(req),
    username: "system",
    action: "update",
    targetCollection: "settings",
    documentId: settings._id.toString(),
    oldValue: old?.toObject(),
    newValue: settings.toObject()
  });
  sendSuccess(res, settings);
}));
router$1.get("/audit-logs", asyncHandler(async (req, res) => {
  const { page: page2 = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const [data, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    AuditLog.countDocuments()
  ]);
  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
const router = express.Router();
router.use(attachActor);
const EXPENSE_LABELS = {
  merchandise: "Achats de marchandises",
  transport: "Transport",
  rent: "Loyer",
  electricity: "Électricité",
  other: "Autres charges"
};
function getPeriodBounds(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}
router.get("/finance/client-tracking", asyncHandler(async (req, res) => {
  const { customerId, page: page2 = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page2, 10);
  const limitNum = parseInt(limit, 10);
  const filter = {};
  if (customerId) filter.customerId = customerId;
  const [slips, total] = await Promise.all([
    PurchaseSlip.find({
      ...filter,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    PurchaseSlip.countDocuments({
      ...filter,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    })
  ]);
  const rows = slips.map((slip) => ({
    _id: slip._id.toString(),
    date: slip.createdAt,
    customerName: slip.customerName || "Client",
    customerId: slip.customerId?.toString(),
    reference: slip.reference,
    documentType: "purchase_slip",
    totalInvoice: slip.totalTTC,
    amountPaid: slip.amountPaid,
    currentDebt: slip.amountDue,
    maxPayment: getSlipMaxPayment(slip),
    awaitingTimbre: isSlipAwaitingTimbre(slip)
  }));
  sendSuccess(res, { data: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));
router.get("/finance/summary", asyncHandler(async (req, res) => {
  const now = /* @__PURE__ */ new Date();
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const { start, end } = getPeriodBounds(year, month);
  const sales = await Sale.find({ isCancelled: false, createdAt: { $gte: start, $lte: end } });
  let recettesVentes = 0;
  for (const sale of sales) {
    if (sale.paymentMethod === "cash") {
      recettesVentes += sale.totalTTC;
    } else if (sale.paymentMethod === "card") {
      recettesVentes += sale.totalTTC;
    } else if (sale.paymentMethod === "mixed") {
      recettesVentes += (sale.cashReceived || 0) + (sale.cardAmount || 0);
    }
  }
  const customerPayments = await Payment.find({
    type: "customer",
    createdAt: { $gte: start, $lte: end }
  });
  const recettesPaiements = customerPayments.reduce((s, p) => s + p.amount, 0);
  const recettes = roundMoney(recettesVentes + recettesPaiements);
  const manualExpenses = await Expense.find({ date: { $gte: start, $lte: end } });
  const depensesManuelles = manualExpenses.reduce((s, e) => s + e.amount, 0);
  const purchaseOrders = await PurchaseOrder.find({
    status: { $in: ["partial", "received"] },
    updatedAt: { $gte: start, $lte: end }
  });
  const depensesAchats = purchaseOrders.reduce((s, po) => s + po.totalHT, 0);
  const depenses = roundMoney(depensesManuelles + depensesAchats);
  const beneficeNet = roundMoney(recettes - depenses);
  const categoryTotals = /* @__PURE__ */ new Map();
  for (const e of manualExpenses) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) || 0) + e.amount);
  }
  if (depensesAchats > 0) {
    categoryTotals.set("merchandise", (categoryTotals.get("merchandise") || 0) + depensesAchats);
  }
  const depensesParCategorie = Array.from(categoryTotals.entries()).map(([category, total]) => ({
    category,
    label: EXPENSE_LABELS[category] || category,
    total: roundMoney(total)
  }));
  sendSuccess(res, {
    recettes,
    depenses,
    beneficeNet,
    depensesParCategorie,
    recettesDetail: [
      { source: "Ventes encaissées (espèces/carte)", total: roundMoney(recettesVentes) },
      { source: "Paiements crédit client", total: roundMoney(recettesPaiements) }
    ],
    expenses: manualExpenses,
    period: { year, month }
  });
}));
router.get("/expenses", asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = {};
  if (year && month) {
    const { start, end } = getPeriodBounds(parseInt(year, 10), parseInt(month, 10));
    filter.date = { $gte: start, $lte: end };
  }
  const expenses = await Expense.find(filter).sort({ date: -1 });
  sendSuccess(res, expenses);
}));
router.post("/expenses", asyncHandler(async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    handleZodError(res, parsed.error);
    return;
  }
  const expense = await Expense.create({
    ...parsed.data,
    date: new Date(parsed.data.date),
    createdBy: getActorId(req)
  });
  sendSuccess(res, expense, 201);
}));
router.delete("/expenses/:id", asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) {
    sendError(res, "Dépense introuvable", 404);
    return;
  }
  sendSuccess(res, { message: "Dépense supprimée" });
}));
let serverPort$1 = DEFAULT_PORT;
function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", port: serverPort$1 } });
  });
  app.get("/api", (_req, res) => {
    res.json({ success: true, data: { name: "Gestionnaire Quincaillerie API", version: "1.0.0" } });
  });
  app.use("/api", router$8);
  app.use("/api", router$7);
  app.use("/api", router$6);
  app.use("/api", router$5);
  app.use("/api", router$4);
  app.use("/api", router$3);
  app.use("/api", router$2);
  app.use("/api", router$1);
  app.use("/api", router);
  app.use((req, res) => {
    console.warn(`[API 404] ${req.method} ${req.originalUrl}`);
    sendError(res, `Route introuvable : ${req.method} ${req.path}`, 404);
  });
  app.use((err, _req, res, _next) => {
    console.error("[API Error]", err);
    sendError(res, err.message || "Erreur serveur", 500);
  });
  return app;
}
async function startServer(port = DEFAULT_PORT) {
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1", () => {
      serverPort$1 = port;
      console.log(`[API] Server running on http://127.0.0.1:${port}`);
      resolve(port);
    });
    server.on("error", reject);
  });
}
function getServerPort() {
  return serverPort$1;
}
let serverPort = DEFAULT_PORT;
let dbCache = null;
function demoDataPath() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  return path.join(portableDir || electron.app.getPath("userData"), "demo-data.json");
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function monthKey(date = /* @__PURE__ */ new Date()) {
  return date.toISOString().slice(0, 7);
}
function nextCounter(db, key) {
  db.counters[key] = (db.counters[key] || 0) + 1;
  return db.counters[key];
}
function makeId(prefix, db) {
  return `${prefix}-${String(nextCounter(db, prefix)).padStart(6, "0")}`;
}
function seedDb() {
  const categories = [
    { _id: "cat-electricite", name: "Electricite", prefix: "ELE" },
    { _id: "cat-plomberie", name: "Plomberie", prefix: "PLB" },
    { _id: "cat-outillage", name: "Outillage", prefix: "OUT" },
    { _id: "cat-peinture", name: "Peinture", prefix: "PEI" }
  ];
  const suppliers = [
    { _id: "sup-001", companyName: "Comptoir General", phone: "71111222" },
    { _id: "sup-002", companyName: "Tunisie Outillage", phone: "72222333" }
  ];
  const customers = [
    { _id: "cus-001", reference: "CLI-000001", name: "hamadi", phone: "29665911", balance: 0 },
    { _id: "cus-002", reference: "CLI-000002", name: "Kaycer Khouini", phone: "29665911", balance: 0 },
    { _id: "cus-003", reference: "CLI-000003", name: "Abdelkader", phone: "22000111", balance: 0 }
  ];
  const products = [
    { _id: "prd-001", reference: "ELE000001", designation: "Carte Arduino", barcode: "6190000000010", categoryId: categories[0], supplierId: suppliers[0], purchasePrice: 18, salePrice: 30, profitMargin: 66.67, discount: 0, tva: 19, stock: 100, minStock: 5, unit: "piece", location: "A1" },
    { _id: "prd-002", reference: "OUT000002", designation: "test", barcode: "6190000000027", categoryId: categories[2], supplierId: suppliers[1], purchasePrice: 10, salePrice: 15, profitMargin: 50, discount: 0, tva: 19, stock: 40, minStock: 5, unit: "piece", location: "B2" },
    { _id: "prd-003", reference: "ELE000003", designation: "fil rigide 1.5mm", barcode: "6190000000034", categoryId: categories[0], supplierId: suppliers[0], purchasePrice: 0.7, salePrice: 1.2, profitMargin: 71.43, discount: 0, tva: 19, stock: 29, minStock: 10, unit: "m", location: "C1" },
    { _id: "prd-004", reference: "PLB000004", designation: "Semant", barcode: "6190000000041", categoryId: categories[1], supplierId: suppliers[0], purchasePrice: 7, salePrice: 11.5, profitMargin: 64.29, discount: 0, tva: 19, stock: 1, minStock: 3, unit: "sac", location: "D1" },
    { _id: "prd-005", reference: "OUT000005", designation: "Marteau 500g", barcode: "6190000000058", categoryId: categories[2], supplierId: suppliers[1], purchasePrice: 12, salePrice: 19.9, profitMargin: 65.83, discount: 0, tva: 19, stock: 18, minStock: 4, unit: "piece", location: "B1" },
    { _id: "prd-006", reference: "PEI000006", designation: "Peinture blanche 5L", barcode: "6190000000065", categoryId: categories[3], supplierId: suppliers[0], purchasePrice: 22, salePrice: 34.5, profitMargin: 56.82, discount: 0, tva: 19, stock: 12, minStock: 3, unit: "L", location: "P1" }
  ];
  return {
    settings: { ...DEFAULT_SETTINGS, companyName: "Quincaillerie Demo", companyPhone: "29665911" },
    categories,
    suppliers,
    customers,
    products,
    invoices: [],
    purchaseSlips: [],
    purchaseOrders: [
      { _id: "po-001", reference: "BC-2026-000012", supplierId: suppliers[0], status: "received", totalTTC: 420, createdAt: "2026-06-30T09:10:00.000Z" },
      { _id: "po-002", reference: "BC-2026-000011", supplierId: suppliers[1], status: "received", totalTTC: 360, createdAt: "2026-06-30T08:20:00.000Z" },
      { _id: "po-003", reference: "BC-2026-000010", supplierId: suppliers[0], status: "received", totalTTC: 250, createdAt: "2026-06-29T15:30:00.000Z" }
    ],
    stockMovements: [],
    expenses: [],
    counters: { PRD: 6, CLI: 3, FAC: 0, BA: 0, sale: 0, movement: 0, supplier: 2, purchaseOrder: 12 }
  };
}
async function loadDb() {
  if (dbCache) return dbCache;
  const file = demoDataPath();
  try {
    const raw = await fs.readFile(file, "utf8");
    dbCache = JSON.parse(raw);
  } catch {
    dbCache = seedDb();
    await saveDb(dbCache);
  }
  return dbCache;
}
async function saveDb(db) {
  dbCache = db;
  const file = demoDataPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
}
function send(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}
function page(items, req) {
  const current = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Number(req.query.limit || items.length || 1));
  const start = (current - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    total: items.length,
    page: current,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit))
  };
}
function productCategory(product, db) {
  const id = typeof product.categoryId === "object" ? product.categoryId._id : product.categoryId;
  return db.categories.find((category) => category._id === id);
}
function withProductRelations(product, db) {
  const category = productCategory(product, db);
  const supplierId = typeof product.supplierId === "object" ? product.supplierId._id : product.supplierId;
  const supplier = db.suppliers.find((item) => item._id === supplierId);
  return { ...product, categoryId: category || product.categoryId, supplierId: supplier || product.supplierId };
}
function filterSearch(items, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
}
function documentList(db) {
  return [...db.invoices, ...db.purchaseSlips].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function createCustomer(db, body) {
  const name = String(body.name || body.companyName || "").trim() || "Client Demo";
  const existing = db.customers.find((customer2) => customer2.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const customer = {
    _id: makeId("CLI", db),
    reference: `CLI-${String(db.counters.CLI).padStart(6, "0")}`,
    name,
    phone: String(body.phone || ""),
    balance: 0
  };
  db.customers.unshift(customer);
  await saveDb(db);
  return customer;
}
function computeSale(db, body) {
  const linesInput = Array.isArray(body.lines) ? body.lines : [];
  const includeTva = Boolean(body.includeTva);
  const lines = linesInput.map((line) => {
    const product = db.products.find((item) => item._id === line.productId);
    if (!product) throw new Error("Produit demo introuvable");
    const quantity = Math.max(1, Number(line.quantity || 1));
    const discount = Math.max(0, Number(line.discount || 0));
    const totalHT2 = roundMoney(applyDiscount(product.salePrice * quantity, discount));
    const totalTTC = roundMoney(totalHT2 + (includeTva ? totalHT2 * (product.tva / 100) : 0));
    return {
      productId: product._id,
      reference: product.reference,
      designation: product.designation,
      quantity,
      unitPrice: product.salePrice,
      discount,
      totalHT: totalHT2,
      totalTTC
    };
  });
  const totalHT = roundMoney(lines.reduce((sum, line) => sum + line.totalHT, 0));
  const fodec = calculateFodec(
    lines.reduce((sum, line) => {
      const product = db.products.find((item) => item._id === line.productId);
      return sum + (product?.subjectToFodec ? line.totalHT : 0);
    }, 0)
  );
  const totalBeforeStamp = roundMoney(lines.reduce((sum, line) => sum + line.totalTTC, 0) + fodec);
  const paymentMethod = String(body.paymentMethod || "cash");
  const cashReceived = body.cashReceived === void 0 ? totalBeforeStamp + TIMBRE_FISCAL_AMOUNT : Number(body.cashReceived);
  const paidAmount = paymentMethod === "credit" ? 0 : Math.min(cashReceived, totalBeforeStamp + TIMBRE_FISCAL_AMOUNT);
  const amountDue = roundMoney(totalBeforeStamp + TIMBRE_FISCAL_AMOUNT - paidAmount);
  return { lines, totalHT, totalTTC: roundMoney(totalBeforeStamp + TIMBRE_FISCAL_AMOUNT), paidAmount, amountDue };
}
function createDemoApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.get("/api/health", (_req, res) => send(res, { status: "ok", mode: "demo", port: serverPort, dataFile: demoDataPath() }));
  app.get("/api", (_req, res) => send(res, { name: "Gestionnaire Quincaillerie Demo API", version: "1.0.0" }));
  app.get("/api/settings", async (_req, res) => send(res, (await loadDb()).settings));
  app.put("/api/settings", async (req, res) => {
    const db = await loadDb();
    db.settings = { ...db.settings, ...req.body };
    await saveDb(db);
    send(res, db.settings);
  });
  app.get("/api/dashboard", async (_req, res) => {
    const db = await loadDb();
    const docs = documentList(db);
    const currentMonth = monthKey();
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const todayDocs = docs.filter((doc) => doc.createdAt.startsWith(today));
    const monthDocs = docs.filter((doc) => doc.createdAt.startsWith(currentMonth));
    const top = /* @__PURE__ */ new Map();
    for (const doc of docs) {
      for (const line of doc.lines) {
        const current = top.get(line.productId) || { productId: line.productId, designation: line.designation, quantity: 0, revenue: 0 };
        current.quantity += line.quantity;
        current.revenue += line.totalTTC;
        top.set(line.productId, current);
      }
    }
    const fallbackTop = db.products.slice(0, 5).map((product) => ({ productId: product._id, designation: product.designation, quantity: product.stock, revenue: product.salePrice * product.stock }));
    send(res, {
      todayRevenue: roundMoney(todayDocs.reduce((sum, doc) => sum + doc.totalTTC, 0)),
      todaySales: todayDocs.length,
      todayProfit: roundMoney(todayDocs.reduce((sum, doc) => sum + doc.totalHT * 0.35, 0)),
      todayInvoices: todayDocs.filter((doc) => doc.reference.startsWith("FAC")).length,
      lowStockCount: db.products.filter((product) => product.stock <= product.minStock).length,
      recentPurchases: db.purchaseOrders.slice(0, 3),
      recentCustomers: db.customers.slice(0, 3),
      topProducts: [...top.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5).concat(top.size ? [] : fallbackTop),
      monthlySales: [{ month: currentMonth, revenue: roundMoney(monthDocs.reduce((sum, doc) => sum + doc.totalTTC, 0) || 7600), profit: roundMoney(monthDocs.reduce((sum, doc) => sum + doc.totalHT * 0.35, 0) || 6700) }]
    });
  });
  app.get("/api/categories", async (_req, res) => send(res, (await loadDb()).categories));
  app.get("/api/subcategories", (_req, res) => send(res, []));
  app.get("/api/products/export/excel", async (_req, res) => {
    const db = await loadDb();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=produits-demo.csv");
    res.send(["reference,designation,stock,prix", ...db.products.map((p) => `${p.reference},${p.designation},${p.stock},${p.salePrice}`)].join("\n"));
  });
  app.get("/api/products/barcode/:code", async (req, res) => {
    const db = await loadDb();
    const product = db.products.find((item) => item.barcode === req.params.code || item.reference === req.params.code);
    if (!product) return res.status(404).json({ success: false, error: { message: "Produit demo introuvable" } });
    send(res, withProductRelations(product, db));
  });
  app.get("/api/products", async (req, res) => {
    const db = await loadDb();
    const categoryId = String(req.query.categoryId || "");
    let products = db.products.map((product) => withProductRelations(product, db));
    if (categoryId) products = products.filter((product) => (typeof product.categoryId === "object" ? product.categoryId._id : product.categoryId) === categoryId);
    send(res, page(filterSearch(products, req.query.search), req));
  });
  app.post("/api/products", async (req, res) => {
    const db = await loadDb();
    const category = db.categories.find((item) => item._id === req.body.categoryId) || db.categories[0];
    const product = {
      _id: makeId("PRD", db),
      reference: `${category.prefix}${String(db.counters.PRD).padStart(6, "0")}`,
      designation: String(req.body.designation || "Produit demo"),
      barcode: String(req.body.barcode || ""),
      categoryId: category,
      supplierId: req.body.supplierId,
      brand: String(req.body.brand || ""),
      purchasePrice: Number(req.body.purchasePrice || 0),
      salePrice: roundMoney(Number(req.body.purchasePrice || 0) * (1 + Number(req.body.profitMargin || 25) / 100)),
      profitMargin: Number(req.body.profitMargin || 25),
      discount: Number(req.body.discount || 0),
      tva: Number(req.body.tva || 19),
      subjectToFodec: Boolean(req.body.subjectToFodec),
      stock: Number(req.body.stock || 0),
      minStock: Number(req.body.minStock || 0),
      unit: String(req.body.unit || "piece"),
      location: String(req.body.location || "")
    };
    db.products.unshift(product);
    await saveDb(db);
    send(res, withProductRelations(product, db), 201);
  });
  app.put("/api/products/:id", async (req, res) => {
    const db = await loadDb();
    const index = db.products.findIndex((item) => item._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: { message: "Produit demo introuvable" } });
    const category = db.categories.find((item) => item._id === req.body.categoryId) || productCategory(db.products[index], db) || db.categories[0];
    db.products[index] = { ...db.products[index], ...req.body, categoryId: category, salePrice: roundMoney(Number(req.body.purchasePrice ?? db.products[index].purchasePrice) * (1 + Number(req.body.profitMargin ?? db.products[index].profitMargin) / 100)) };
    await saveDb(db);
    send(res, withProductRelations(db.products[index], db));
  });
  app.delete("/api/products/:id", async (req, res) => {
    const db = await loadDb();
    db.products = db.products.filter((item) => item._id !== req.params.id);
    await saveDb(db);
    send(res, { deleted: true });
  });
  app.get("/api/customers/credits/open", async (_req, res) => {
    const db = await loadDb();
    send(res, db.customers.filter((customer) => (customer.balance || 0) > 0).map((customer) => ({ customer, balance: customer.balance || 0 })));
  });
  app.get("/api/customers", async (req, res) => send(res, page(filterSearch((await loadDb()).customers, req.query.search), req)));
  app.post("/api/customers/quick", async (req, res) => send(res, { ...await createCustomer(await loadDb(), req.body), created: true }, 201));
  app.post("/api/customers", async (req, res) => send(res, await createCustomer(await loadDb(), req.body), 201));
  app.put("/api/customers/:id", async (req, res) => {
    const db = await loadDb();
    const customer = db.customers.find((item) => item._id === req.params.id);
    if (customer) Object.assign(customer, req.body);
    await saveDb(db);
    send(res, customer || null);
  });
  app.delete("/api/customers/:id", async (req, res) => {
    const db = await loadDb();
    db.customers = db.customers.filter((item) => item._id !== req.params.id);
    await saveDb(db);
    send(res, { deleted: true });
  });
  app.get("/api/customers/:id/tracking", async (req, res) => send(res, { customerId: req.params.id, rows: [], totalDebt: 0, totalPaid: 0 }));
  app.post("/api/customer-payments", (_req, res) => send(res, { paid: true }, 201));
  app.post("/api/sales", async (req, res) => {
    const db = await loadDb();
    const computed = computeSale(db, req.body);
    const documentType = computed.amountDue > 0 ? "purchase_slip" : "invoice";
    const key = documentType === "invoice" ? "FAC" : "BA";
    const reference = `${key}-2026-${String(nextCounter(db, key)).padStart(6, "0")}`;
    let customerName = String(req.body.customerName || "");
    let customerId = String(req.body.customerId || "");
    if (customerName && !customerId) {
      const customer = await createCustomer(db, { name: customerName });
      customerId = customer._id;
      customerName = customer.name;
    }
    const doc = {
      _id: makeId("sale", db),
      reference,
      customerId: customerId || void 0,
      customerName: customerName || void 0,
      lines: computed.lines,
      totalHT: computed.totalHT,
      totalTTC: computed.totalTTC,
      paidAmount: computed.paidAmount,
      amountDue: computed.amountDue,
      paymentMethod: String(req.body.paymentMethod || "cash"),
      status: computed.amountDue > 0 ? "unpaid" : "paid",
      createdAt: nowIso()
    };
    for (const line of computed.lines) {
      const product = db.products.find((item) => item._id === line.productId);
      if (!product) continue;
      const before = product.stock;
      product.stock = Math.max(0, product.stock - line.quantity);
      db.stockMovements.unshift({ _id: makeId("movement", db), createdAt: nowIso(), type: "out", reason: "sale", quantity: line.quantity, stockBefore: before, stockAfter: product.stock, productId: { designation: product.designation } });
    }
    if (documentType === "invoice") db.invoices.unshift(doc);
    else db.purchaseSlips.unshift(doc);
    await saveDb(db);
    send(res, { documentType, invoice: documentType === "invoice" ? doc : void 0, purchaseSlip: documentType === "purchase_slip" ? doc : void 0 }, 201);
  });
  app.get("/api/invoices", async (req, res) => send(res, page((await loadDb()).invoices, req)));
  app.get("/api/purchase-slips", async (req, res) => send(res, page((await loadDb()).purchaseSlips, req)));
  app.get("/api/invoices/:id", async (req, res) => send(res, (await loadDb()).invoices.find((item) => item._id === req.params.id) || null));
  app.get("/api/purchase-slips/:id", async (req, res) => send(res, (await loadDb()).purchaseSlips.find((item) => item._id === req.params.id) || null));
  app.get("/api/invoices/:id/receipt", (_req, res) => send(res, { data: Buffer.from("DEMO RECEIPT").toString("base64") }));
  app.get("/api/purchase-slips/:id/receipt", (_req, res) => send(res, { data: Buffer.from("DEMO RECEIPT").toString("base64") }));
  app.get("/api/stock/valuation", async (_req, res) => {
    const db = await loadDb();
    send(res, {
      totalProducts: db.products.length,
      purchaseValue: roundMoney(db.products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0)),
      saleValue: roundMoney(db.products.reduce((sum, p) => sum + p.salePrice * p.stock, 0)),
      lowStockProducts: db.products.filter((p) => p.stock <= p.minStock)
    });
  });
  app.get("/api/stock/movements", async (req, res) => send(res, page((await loadDb()).stockMovements, req)));
  app.post("/api/stock/adjust", async (req, res) => {
    const db = await loadDb();
    const product = db.products.find((item) => item._id === req.body.productId);
    if (product) {
      const before = product.stock;
      product.stock = Number(req.body.quantity || 0);
      db.stockMovements.unshift({ _id: makeId("movement", db), createdAt: nowIso(), type: product.stock >= before ? "in" : "out", reason: "correction", quantity: Math.abs(product.stock - before), stockBefore: before, stockAfter: product.stock, productId: { designation: product.designation } });
    }
    await saveDb(db);
    send(res, product || null);
  });
  app.post("/api/inventory", (_req, res) => send(res, { saved: true }, 201));
  app.get("/api/suppliers", async (req, res) => send(res, page(filterSearch((await loadDb()).suppliers, req.query.search), req)));
  app.post("/api/suppliers", async (req, res) => {
    const db = await loadDb();
    const supplier = { _id: makeId("supplier", db), companyName: String(req.body.companyName || "Fournisseur Demo"), phone: String(req.body.phone || "") };
    db.suppliers.unshift(supplier);
    await saveDb(db);
    send(res, supplier, 201);
  });
  app.put("/api/suppliers/:id", async (req, res) => {
    const db = await loadDb();
    const supplier = db.suppliers.find((item) => item._id === req.params.id);
    if (supplier) Object.assign(supplier, req.body);
    await saveDb(db);
    send(res, supplier || null);
  });
  app.delete("/api/suppliers/:id", async (req, res) => {
    const db = await loadDb();
    db.suppliers = db.suppliers.filter((item) => item._id !== req.params.id);
    await saveDb(db);
    send(res, { deleted: true });
  });
  app.get("/api/suppliers/:id/activity", async (req, res) => send(res, { supplierId: req.params.id, orders: [], payments: [], totalDue: 0 }));
  app.post("/api/supplier-payments", (_req, res) => send(res, { paid: true }, 201));
  app.get("/api/purchase-orders", async (req, res) => send(res, page((await loadDb()).purchaseOrders, req)));
  app.post("/api/purchase-orders", async (req, res) => {
    const db = await loadDb();
    const order = { _id: makeId("purchaseOrder", db), reference: `BC-2026-${String(db.counters.purchaseOrder).padStart(6, "0")}`, ...req.body, status: "draft", createdAt: nowIso() };
    db.purchaseOrders.unshift(order);
    await saveDb(db);
    send(res, order, 201);
  });
  app.post("/api/purchase-orders/quick-receive", (_req, res) => send(res, { received: true }, 201));
  app.post("/api/purchase-orders/:id/receive", (_req, res) => send(res, { received: true }));
  app.post("/api/purchase-orders/:id/pay", (_req, res) => send(res, { paid: true }));
  app.post("/api/purchase-orders/:id/status", (_req, res) => send(res, { updated: true }));
  app.get("/api/supplier-invoices", (req, res) => send(res, page([], req)));
  app.get("/api/finance/summary", (_req, res) => send(res, { revenue: 0, expenses: 0, profit: 0, byCategory: [] }));
  app.post("/api/expenses", (_req, res) => send(res, { created: true }, 201));
  app.delete("/api/expenses/:id", (_req, res) => send(res, { deleted: true }));
  app.get("/api/reports/sales", (_req, res) => send(res, { total: 0, count: 0, rows: [] }));
  app.get("/api/reports/profit", (_req, res) => send(res, { revenue: 0, cost: 0, profit: 0 }));
  app.get("/api/reports/top-products", async (_req, res) => send(res, (await loadDb()).products.slice(0, 5)));
  app.get("/api/reports/top-customers", async (_req, res) => send(res, (await loadDb()).customers.slice(0, 5)));
  app.use((req, res) => {
    res.status(404).json({ success: false, error: { message: `Route demo introuvable : ${req.method} ${req.path}` } });
  });
  app.use((err, _req, res) => {
    console.error("[Demo API Error]", err);
    res.status(500).json({ success: false, error: { message: err.message || "Erreur demo" } });
  });
  return app;
}
async function startDemoServer(port = DEFAULT_PORT) {
  const demoApp = createDemoApp();
  return new Promise((resolve, reject) => {
    const server = demoApp.listen(port, "127.0.0.1", () => {
      serverPort = port;
      console.log(`[DEMO API] Server running on http://127.0.0.1:${port}`);
      resolve(port);
    });
    server.on("error", reject);
  });
}
function isDemoMode() {
  const markers = [
    process.env.DEMO_MODE,
    electron.app.isReady() ? electron.app.getName() : "",
    process.execPath,
    process.env.PORTABLE_EXECUTABLE_FILE
  ];
  return markers.some((value) => value?.toLowerCase().includes("demo"));
}
const LICENSE_SERVER_URL = "https://licenceskayapps.duckdns.org/api/v1/client";
const PRODUCT_SLUG = "hardware-store";
const LICENSE_CHECK_INTERVAL_DAYS = 30;
const store = new Store({ name: "license-data" });
let cachedPublicKey = null;
function getMachineId() {
  try {
    const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model ?? "cpu"}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  } catch {
    return crypto.randomBytes(32).toString("hex");
  }
}
function loadStored() {
  return store.get("license") ?? null;
}
function saveStored(data) {
  const stored = {
    licenseToken: data.licenseToken,
    licenseKey: data.licenseKey,
    payload: data.payload,
    signature: data.signature,
    lastVerified: (/* @__PURE__ */ new Date()).toISOString(),
    checkIntervalDays: data.checkIntervalDays ?? LICENSE_CHECK_INTERVAL_DAYS
  };
  store.set("license", stored);
  return stored;
}
let lastFetchTime = 0;
const FETCH_COOLDOWN = 2e3;
async function fetchPublicKey(forceRefresh = false) {
  if (!forceRefresh && cachedPublicKey) return cachedPublicKey;
  if (!forceRefresh) {
    const storedKey = store.get("publicKey");
    if (storedKey) {
      cachedPublicKey = storedKey;
      return storedKey;
    }
  }
  const now = Date.now();
  if (!forceRefresh && cachedPublicKey && now - lastFetchTime < FETCH_COOLDOWN) {
    console.log("[License] Using cached public key (cooldown)");
    return cachedPublicKey;
  }
  console.log("[License] Fetching public key from:", `${LICENSE_SERVER_URL}/public-key`);
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/public-key`, {
      headers: {
        "Accept": "application/json"
      }
    });
    console.log("[License] Response status:", res.status);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    const publicKey = json.data.publicKey;
    if (!publicKey) throw new Error("Clé publique introuvable dans la réponse");
    cachedPublicKey = publicKey;
    lastFetchTime = Date.now();
    store.set("publicKey", cachedPublicKey);
    console.log("[License] Public key fetched successfully");
    return cachedPublicKey;
  } catch (error) {
    console.error("[License] Error fetching public key:", error);
    throw new Error(`Impossible de récupérer la clé publique: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
function verifyPayloadSignature(payload, signature, publicKey) {
  try {
    const verify = crypto.createVerify("SHA256");
    verify.update(JSON.stringify(payload));
    verify.end();
    return verify.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}
async function apiPost(path2, body) {
  const res = await fetch(`${LICENSE_SERVER_URL}${path2}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    const errMsg = typeof json.error === "string" ? json.error : json.error?.message ?? "Erreur serveur de licences";
    throw new Error(errMsg);
  }
  return json;
}
function toStatusResponse(gate, stored, extra) {
  return {
    status: gate,
    authorizedModules: stored?.payload.authorizedModules ?? [],
    payload: stored?.payload,
    licenseKey: stored?.licenseKey ?? stored?.payload.licenseKey,
    expiresAt: stored?.payload.expiresAt,
    clientName: stored?.payload.clientName,
    licenseType: stored?.payload.licenseType,
    adminNotes: stored?.payload.adminNotes,
    checkIntervalDays: stored?.checkIntervalDays,
    ...extra
  };
}
const OFFLINE_GRACE_DAYS = 10;
async function tryOnlineVerify(stored, publicKey) {
  let json;
  try {
    json = await apiPost("/verify", {
      licenseToken: stored.licenseToken,
      machineId: getMachineId(),
      appVersion: electron.app.getVersion()
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/suspendue/i.test(msg)) return { ok: false, reason: "suspended", message: msg };
    if (/expir/i.test(msg)) return { ok: false, reason: "expired", message: msg };
    if (/non trouvée|non correspondant|non active/i.test(msg)) {
      return { ok: false, reason: "invalid", message: msg };
    }
    return { ok: false, reason: "network", message: msg };
  }
  const { data } = json;
  if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
    return { ok: false, reason: "invalid", message: "Signature invalide après vérification" };
  }
  const updated = saveStored({
    licenseToken: data.licenseToken,
    licenseKey: data.licenseKey,
    payload: data.payload,
    signature: data.signature,
    checkIntervalDays: data.checkIntervalDays
  });
  return { ok: true, updated };
}
async function getLicenseStatus(forceOnline = false) {
  if (isDemoMode()) {
    return {
      status: "active",
      authorizedModules: ["products", "stock", "pos", "billing"],
      clientName: "Client Demo",
      licenseType: "demo",
      licenseKey: "DEMO-PORTABLE",
      adminNotes: "Version demo portable avec donnees JSON locales."
    };
  }
  const stored = loadStored();
  if (!stored) {
    return toStatusResponse("not_activated", null);
  }
  let publicKey = cachedPublicKey ?? store.get("publicKey") ?? null;
  if (!publicKey) {
    try {
      publicKey = await fetchPublicKey();
    } catch {
      publicKey = null;
    }
  }
  if (!publicKey) {
    return toStatusResponse("invalid", stored, {
      message: "Clé publique introuvable — une connexion internet est requise lors de la première activation."
    });
  }
  if (!verifyPayloadSignature(stored.payload, stored.signature, publicKey)) {
    return toStatusResponse("invalid", stored, { message: "Signature de licence invalide" });
  }
  if (!forceOnline && stored.payload.status !== "active") {
    return toStatusResponse(stored.payload.status, stored);
  }
  if (!forceOnline && stored.payload.expiresAt && new Date(stored.payload.expiresAt) < /* @__PURE__ */ new Date()) {
    return toStatusResponse("expired", stored, { message: "Licence expirée" });
  }
  const daysSinceVerified = (Date.now() - new Date(stored.lastVerified).getTime()) / (1e3 * 60 * 60 * 24);
  if (!forceOnline && daysSinceVerified <= stored.checkIntervalDays) {
    return toStatusResponse("active", stored);
  }
  const result = await tryOnlineVerify(stored, publicKey);
  if (result.ok) {
    return toStatusResponse(result.updated.payload.status, result.updated);
  }
  if (result.reason === "suspended") {
    return toStatusResponse("suspended", stored, { message: result.message });
  }
  if (result.reason === "expired") {
    return toStatusResponse("expired", stored, { message: result.message });
  }
  if (result.reason === "invalid") {
    return toStatusResponse("invalid", stored, { message: result.message });
  }
  if (stored.payload.status !== "active") {
    return toStatusResponse(stored.payload.status, stored, {
      message: result.message
    });
  }
  if (stored.payload.expiresAt && new Date(stored.payload.expiresAt) < /* @__PURE__ */ new Date()) {
    return toStatusResponse("expired", stored, { message: result.message ?? "Licence expirée" });
  }
  if (daysSinceVerified <= stored.checkIntervalDays + OFFLINE_GRACE_DAYS) {
    return toStatusResponse("active", stored, {
      message: `Mode hors-ligne — dernière vérification il y a ${Math.floor(
        daysSinceVerified
      )} jours. Reconnectez-vous bientôt à internet.`
    });
  }
  return toStatusResponse("expired", stored, {
    message: "Connexion internet requise pour revalider votre licence."
  });
}
async function activateLicense(params) {
  await fetchPublicKey(true);
  if (params.requestId) {
    try {
      const statusResponse = await apiPost("/activation/status", {
        requestId: params.requestId,
        machineId: getMachineId(),
        appVersion: electron.app.getVersion()
      });
      const statusData = statusResponse.data;
      const publicKey2 = cachedPublicKey;
      if (statusData.status === "pending") {
        return {
          success: true,
          status: "pending",
          message: "Demande toujours en attente de validation",
          requestId: params.requestId
        };
      }
      if (statusData.status === "rejected") {
        clearPendingActivation();
        return {
          success: false,
          status: "error",
          message: statusData.reason || "Demande rejetée par administrateur",
          requestId: params.requestId
        };
      }
      if (statusData.status === "activated") {
        if (statusData.licenseToken && statusData.payload && statusData.signature) {
          if (!verifyPayloadSignature(statusData.payload, statusData.signature, publicKey2)) {
            return { success: false, status: "error", message: "Signature de licence invalide" };
          }
          saveStored({
            licenseToken: statusData.licenseToken,
            licenseKey: statusData.licenseKey ?? statusData.payload.licenseKey,
            payload: statusData.payload,
            signature: statusData.signature,
            checkIntervalDays: statusData.checkIntervalDays
          });
          clearPendingActivation();
          return {
            success: true,
            status: "activated",
            message: "Licence activée — vous pouvez utiliser le logiciel"
          };
        }
      }
    } catch (err) {
      console.debug("[License] Vérification statut échouée, nouvelle demande:", err instanceof Error ? err.message : "Unknown error");
    }
  }
  const json = await apiPost("/activate", {
    productSlug: PRODUCT_SLUG,
    licenseKey: params.licenseKey || void 0,
    companyName: params.companyName,
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
    machineId: getMachineId(),
    appVersion: electron.app.getVersion(),
    osInfo: `${os.platform()} ${os.release()}`,
    hostname: os.hostname()
  });
  const { data } = json;
  let publicKey = cachedPublicKey;
  if (data.status === "activated" || data.status === "already_active") {
    if (!publicKey) {
      publicKey = await fetchPublicKey(true);
    }
  }
  if (data.status === "pending") {
    const pendingParams = {
      ...params,
      requestId: data.requestId
    };
    savePendingActivation(pendingParams);
    return {
      success: true,
      status: "pending",
      message: data.message ?? "Demande envoyée — en attente de validation administrateur",
      requestId: data.requestId
    };
  }
  clearPendingActivation();
  if ((data.status === "activated" || data.status === "already_active") && data.licenseToken && data.payload && data.signature) {
    if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
      try {
        publicKey = await fetchPublicKey(true);
      } catch {
      }
      if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
        store.delete("publicKey");
        cachedPublicKey = null;
        return { success: false, status: "error", message: "Signature de licence invalide" };
      }
    }
    saveStored({
      licenseToken: data.licenseToken,
      licenseKey: data.licenseKey ?? data.payload.licenseKey,
      payload: data.payload,
      signature: data.signature,
      checkIntervalDays: data.checkIntervalDays
    });
    return {
      success: true,
      status: data.status === "already_active" ? "already_active" : "activated",
      message: "Licence activée — vous pouvez utiliser le logiciel"
    };
  }
  return { success: false, status: "error", message: "Réponse serveur inattendue" };
}
async function transferLicense(newMachineId) {
  const stored = loadStored();
  if (!stored) {
    return { success: false, status: "error", message: "Aucune licence locale" };
  }
  const newId = newMachineId?.trim();
  if (!newId || newId.length < 8) {
    return {
      success: false,
      status: "error",
      message: "Nouvel identifiant machine requis pour transférer la licence"
    };
  }
  if (newId === stored.payload.machineId) {
    return {
      success: false,
      status: "error",
      message: "La licence est déjà liée à cet identifiant machine"
    };
  }
  const publicKey = await fetchPublicKey();
  const json = await apiPost("/transfer", {
    licenseToken: stored.licenseToken,
    oldMachineId: stored.payload.machineId,
    newMachineId: newId,
    appVersion: electron.app.getVersion()
  });
  const { data } = json;
  if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
    return { success: false, status: "error", message: "Signature invalide après transfert" };
  }
  saveStored({
    licenseToken: data.licenseToken,
    licenseKey: data.licenseKey,
    payload: data.payload,
    signature: data.signature,
    checkIntervalDays: data.checkIntervalDays
  });
  return { success: true, status: "activated", message: "Licence transférée sur ce poste" };
}
function getAuthorizedModules() {
  if (isDemoMode()) return ["products", "stock", "pos", "billing"];
  return loadStored()?.payload.authorizedModules ?? [];
}
function clearLocalLicense() {
  store.delete("license");
}
function getPendingActivation() {
  return store.get("pendingActivation") ?? null;
}
function savePendingActivation(params) {
  store.set("pendingActivation", params);
}
function clearPendingActivation() {
  store.delete("pendingActivation");
}
async function retryPendingActivation() {
  const pending = getPendingActivation();
  if (!pending) {
    return { success: false, status: "error", message: "Aucune demande en attente" };
  }
  return activateLicense(pending);
}
let mainWindow = null;
async function initApp() {
  if (isDemoMode()) {
    console.log("[DEMO] Starting JSON demo mode");
    await startDemoServer(DEFAULT_PORT);
    return;
  }
  let mongoUri = DEFAULT_MONGO_URI;
  try {
    await connectDatabase(mongoUri);
    await seedDatabase();
    const settings = await Settings.findOne();
    if (settings?.mongoUri) {
      mongoUri = settings.mongoUri;
    }
  } catch (err) {
    console.error("[DB] Connection failed:", err);
  }
  await startServer(DEFAULT_PORT);
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Gestionnaire Quincaillerie",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("app:getVersion", () => electron.app.getVersion());
  electron.ipcMain.handle("app:getApiPort", () => getServerPort());
  electron.ipcMain.handle("app:getApiUrl", () => `http://127.0.0.1:${getServerPort()}/api`);
  electron.ipcMain.handle("print:thermal", async (_event, base64Data) => {
    if (!mainWindow) return { success: false, error: "Fenêtre non disponible" };
    try {
      const data = Buffer.from(base64Data, "base64").toString("binary");
      console.log("[Print] Thermal receipt data length:", data.length);
      return { success: true, message: "Ticket envoyé à l'imprimante" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("print:a4", async (_event, pdfBase64) => {
    if (!mainWindow) return { success: false, error: "Fenêtre non disponible" };
    try {
      const pdfWindow = new electron.BrowserWindow({ show: false });
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      await pdfWindow.loadURL(dataUrl);
      await pdfWindow.webContents.print({ silent: false, printBackground: true });
      pdfWindow.close();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("dialog:saveFile", async (_event, defaultName, data) => {
    const { dialog } = await import("electron");
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: "Fichiers", extensions: ["xlsx", "pdf", "json"] }]
    });
    if (!result.canceled && result.filePath) {
      const fs2 = await import("fs/promises");
      await fs2.writeFile(result.filePath, Buffer.from(data, "base64"));
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  electron.ipcMain.handle("license:getStatus", () => getLicenseStatus());
  electron.ipcMain.handle("license:getMachineId", () => getMachineId());
  electron.ipcMain.handle("license:getModules", () => getAuthorizedModules());
  electron.ipcMain.handle("license:activate", (_e, params) => activateLicense(params));
  electron.ipcMain.handle("license:verify", () => getLicenseStatus(true));
  electron.ipcMain.handle("license:transfer", (_e, newMachineId) => transferLicense(newMachineId));
  electron.ipcMain.handle("license:clear", () => {
    clearLocalLicense();
    return { success: true };
  });
  electron.ipcMain.handle("license:getPending", () => getPendingActivation());
  electron.ipcMain.handle("license:retryPending", () => retryPendingActivation());
}
electron.app.whenReady().then(async () => {
  await initApp();
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
