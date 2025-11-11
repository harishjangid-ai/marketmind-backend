// server.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Health route
app.get("/", (req, res) => {
  res.send("✅ MarketMind Hub backend (Cashfree) is running");
});

// Read keys from environment (do NOT hardcode)
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
// Choose API base via env, default to sandbox for safe testing
const CASHFREE_API_BASE = process.env.CASHFREE_API_BASE || "https://api.cashfree.com";

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
  console.warn("⚠️ CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set in env. Set them in Replit/Render secrets.");
}

// Create Cashfree order (returns payment link)
app.post("/create-cashfree-payment", async (req, res) => {
  const { name, email, phone, amount, purpose, productId } = req.body;

  if (!amount) return res.status(400).json({ success: false, error: "Missing amount" });
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return res.status(500).json({ success: false, error: "Server misconfigured (missing Cashfree keys)" });
  }

  try {
    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      order_note: purpose || "MarketMind Hub Order",
      customer_details: {
        customer_id: (phone || "CUST") + "_" + Date.now(),
        customer_email: email || "",
        customer_phone: phone || ""
      },
      order_meta: {
        // Cashfree will replace {order_id} with internal id on return
        return_url: "https://market-mind-hub.netlify.app/success.html?order_id={order_id}"
      }
    };

    const endpoint = `${CASHFREE_API_BASE.replace(/\/$/, "")}/pg/orders`;

    const response = await axios.post(endpoint, payload, {
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "Content-Type": "application/json"
      },
      timeout: 15000
    });

    // Response structure may vary between sandbox & production
    // We try to return the payment_link if present
    const data = response.data || {};
    // If Cashfree returns link under data.payment_link or data.data.payment_link
    const payment_link = data.payment_link || data.data?.payment_link || data.data?.redirect_url || data.redirect_url;

    // Optional: Log the order server-side for later verification (you can expand)
    console.log("Cashfree create order response:", JSON.stringify(data).slice(0, 1000));

    if (!payment_link) {
      return res.status(500).json({ success: false, error: "No payment link returned", raw: data });
    }

    // Return payment link to frontend
    res.json({ success: true, payment_link, raw: data });
  } catch (err) {
    console.error("❌ Cashfree Error:", err.response?.data || err.message);
    const message = err.response?.data || err.message || "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

// Use dynamic port for Replit / Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Cashfree backend running on port ${PORT}`));
