require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_BASE = process.env.CASHFREE_API_BASE || "https://api.cashfree.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://market-mind-hub.netlify.app";

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
  console.error("❌ Missing Cashfree keys — set them in Railway env variables!");
}

// root
app.get("/", (req, res) => {
  res.send("✅ MarketMind Hub backend (Cashfree) running");
});

// debug
app.get("/debug", (req, res) => {
  res.json({
    CASHFREE_APP_ID: !!CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY: !!CASHFREE_SECRET_KEY,
    CASHFREE_API_BASE,
    FRONTEND_URL
  });
});

/**
 * Create Cashfree order and return payment link
 * Expects: { name, email, phone, amount, purpose, productId }
 */
app.post("/create-cashfree-payment", async (req, res) => {
  const { name, email, phone, amount, purpose, productId } = req.body;

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return res.status(500).json({ success: false, error: "Server misconfigured (missing Cashfree keys)" });
  }

  try {
    // return_url will redirect to our backend verify route, which will validate and then redirect to frontend
    const returnUrl = `${FRONTEND_URL}/verify.html?product_id=${encodeURIComponent(productId || "")}&source=cashfree`;

    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      order_note: purpose || "MarketMind Hub Order",
      customer_details: {
        customer_id: "CUST_" + Date.now(),
        customer_email: email || "buyer@marketmindhub.com",
        customer_phone: phone || ""
      },
      order_meta: {
        return_url: returnUrl
      }
    };

    const response = await axios.post(
      `${CASHFREE_API_BASE}/pg/orders`,
      payload,
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "Content-Type": "application/json",
          "x-api-version": "2022-01-01"
        }
      }
    );

    // response.data should contain payment link
    const payment_link =
      response.data?.payment_link ||
      response.data?.data?.payment_link ||
      response.data?.data?.payment_url;

    return res.json({ success: true, payment_request: response.data, payment_link });
  } catch (err) {
    console.error("❌ Cashfree Error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

app.get("/verify-cashfree", async (req, res) => {
  // Cashfree may append different param names; check common ones:
  const orderId = req.query.order_id || req.query.orderId || req.query.cf_order_id || req.query.payment_id || req.query.orderId;
  const productId = req.query.product_id || req.query.productId || "";

  if (!orderId) {
    // No order id -> treat as cancelled
    const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(productId)}&order_status=FAILED`;
    return res.redirect(redirect);
  }

  try {
    const r = await axios.get(`${CASHFREE_API_BASE}/pg/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "Content-Type": "application/json",
        "x-api-version": "2022-01-01"
      }
    });

    const orderData = r.data || {};
    // Cashfree returns order_status values like "PAID", "FAILED", "EXPIRED", etc.
    const status = (orderData.order_status || orderData.data?.order_status || "").toUpperCase();

    if (status === "PAID" || status === "COMPLETED") {
      // success
      const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(productId)}&order_status=SUCCESS&order_id=${encodeURIComponent(orderId)}`;
      return res.redirect(redirect);
    } else {
      // not paid (cancel/failed)
      const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(productId)}&order_status=FAILED&order_id=${encodeURIComponent(orderId)}`;
      return res.redirect(redirect);
    }
  } catch (err) {
    console.error("❌ verify-cashfree error:", err.response?.data || err.message);
    const redirect = `${FRONTEND_URL}/success.html?product_id=${encodeURIComponent(productId)}&order_status=FAILED`;
    return res.redirect(redirect);
  }
});

// For compatibility: many will name endpoint /verify - keep alias
app.get("/verify", (req, res) => res.redirect(302, `/verify-cashfree?${new URLSearchParams(req.query).toString()}`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
