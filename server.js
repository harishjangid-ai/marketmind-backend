require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Default route
app.get("/", (req, res) => {
  res.send("✅ MarketMind Hub backend (Cashfree Sandbox) is running fine!");
});

// Debug route (optional)
app.get("/debug", (req, res) => {
  res.json({
    CASHFREE_APP_ID: process.env.CASHFREE_APP_ID ? "✅ Loaded" : "❌ Missing",
    CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY ? "✅ Loaded" : "❌ Missing",
    CASHFREE_API_BASE: process.env.CASHFREE_API_BASE || "❌ Missing"
  });
});

// Environment Variables
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_BASE = process.env.CASHFREE_API_BASE || "https://sandbox.cashfree.com";

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
  console.error("❌ Missing Cashfree keys — check Railway Variables!");
}

// Payment creation route
app.post("/create-cashfree-payment", async (req, res) => {
  const { name, email, phone, amount, purpose } = req.body;
  console.log("🟢 Payment initiated:", { name, phone, amount, purpose });

  try {
    const response = await axios.post(
      `${CASHFREE_API_BASE}/pg/orders`,
      {
        order_amount: Number(amount),
        order_currency: "INR",
        order_note: purpose || "MarketMind Hub Order",
        customer_details: {
          customer_id: "CUST_" + Date.now(),
          customer_email: email || "buyer@marketmindhub.com",
          customer_phone: phone
        },
        order_meta: {
          return_url: "https://market-mind-hub.netlify.app/success.html?order_id={order_id}"
        }
      },
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Cashfree API success:", response.data);
    res.json({ success: true, payment_link: response.data.payment_link });

  } catch (err) {
    console.error("❌ Cashfree Error:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "Cashfree payment creation failed" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
