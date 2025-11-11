require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// 🟢 Default route
app.get("/", (req, res) => {
  res.send("✅ MarketMind Hub backend (Cashfree) is running perfectly 🚀");
});

// 🟢 Cashfree Sandbox / Live API keys (loaded from environment)
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

// 🟢 Create Payment Route
app.post("/create-cashfree-payment", async (req, res) => {
  const { name, email, phone, amount, purpose } = req.body;

  if (!name || !phone || !amount) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const response = await axios.post(
      "https://sandbox.cashfree.com/pg/orders", // ⚠️ Use "https://api.cashfree.com/pg/orders" for LIVE
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
          return_url: "https://marketmindhub.netlify.app/success.html?order_id={order_id}"
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

    console.log("✅ Cashfree Response:", response.data);

    if (response.data && response.data.payment_session_id) {
      res.json({
        success: true,
        payment_link: response.data.payment_link || response.data.payment_url,
        order_id: response.data.order_id
      });
    } else {
      throw new Error("Payment link not received from Cashfree");
    }

  } catch (err) {
    console.error("❌ Cashfree Error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data?.message || err.message
    });
  }
});

// 🟢 Dynamic port handling for Replit / Render / Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Cashfree backend running on port ${PORT}`)
);
