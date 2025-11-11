require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

const {
  CASHFREE_APP_ID,
  CASHFREE_SECRET_KEY,
  CASHFREE_API_BASE = "https://api.cashfree.com",
  FRONTEND_URL = "https://market-mind-hub.netlify.app"
} = process.env;

// Warn if missing keys
if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
  console.error("❌ Missing Cashfree API keys in environment variables!");
}

// Base route
app.get("/", (req, res) => res.send("✅ MarketMind Hub Cashfree backend running"));

// Debug route
app.get("/debug", (req, res) => {
  res.json({
    CASHFREE_APP_ID: !!CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY: !!CASHFREE_SECRET_KEY,
    CASHFREE_API_BASE,
    FRONTEND_URL,
  });
});

/**
 * ✅ Create Cashfree order
 */
app.post("/create-cashfree-payment", async (req, res) => {
  try {
    const { name, email, phone, amount, purpose, productId } = req.body;

    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      order_note: purpose || "MarketMind Hub Order",
      customer_details: {
        customer_id: "CUST_" + Date.now(),
        customer_email: email || "buyer@marketmindhub.com",
        customer_phone: phone || "",
      },
      order_meta: {
        // Cashfree replaces {order_id} with real ID
        return_url: `${FRONTEND_URL}/verify.html?product_id=${encodeURIComponent(productId)}&order_id={order_id}`,
      },
    };

    const response = await axios.post(`${CASHFREE_API_BASE}/pg/orders`, payload, {
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2022-01-01",
        "Content-Type": "application/json",
      },
    });

    const payment_link =
      response.data?.payment_link ||
      response.data?.data?.payment_link ||
      response.data?.data?.payment_url;

    if (!payment_link) throw new Error("Payment link missing in Cashfree response");

    return res.json({ success: true, payment_link });
  } catch (err) {
    console.error("❌ Cashfree Error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data?.message || err.message || "Server Error",
    });
  }
});

/**
 * ✅ Verify Cashfree Payment
 */
app.get("/verify-cashfree", async (req, res) => {
  const orderId = req.query.order_id || req.query.cf_order_id;
  const productId = req.query.product_id || "";

  if (!orderId) {
    const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(productId)}&order_status=FAILED`;
    return res.redirect(redirect);
  }

  try {
    const r = await axios.get(`${CASHFREE_API_BASE}/pg/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2022-01-01",
        "Content-Type": "application/json",
      },
    });

    const data = r.data || {};
    const status = (data.order_status || data.data?.order_status || "").toUpperCase();

    const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(
      productId
    )}&order_status=${status === "PAID" || status === "COMPLETED" ? "SUCCESS" : "FAILED"}&order_id=${encodeURIComponent(orderId)}`;

    res.redirect(redirect);
  } catch (err) {
    console.error("❌ Verify Error:", err.response?.data || err.message);
    const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(
      productId
    )}&order_status=FAILED`;
    res.redirect(redirect);
  }
});

// alias /verify
app.get("/verify", (req, res) =>
  res.redirect(302, `/verify-cashfree?${new URLSearchParams(req.query).toString()}`)
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
