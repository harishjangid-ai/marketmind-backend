require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// 🟢 Default route
app.get("/", (req, res) => {
  res.send("✅ MarketMind Hub backend (Cashfree) is running");
});

// 🟢 Env variables
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

// 🟢 Create Payment Route
app.post("/create-cashfree-payment", async (req, res) => {
  const { name, email, phone, amount, purpose } = req.body;

  try {
    const response = await axios.post(
      "https://sandbox.cashfree.com/pg/orders",
      {
        order_amount: Number(amount),
        order_currency: "INR",
        order_note: purpose || "MarketMind Hub Order",
        customer_details: {
          customer_id: "CUST_" + Date.now(),
          customer_email: email,
          customer_phone: phone,
        },
        order_meta: {
          return_url:
            "https://marketmindhub.netlify.app/success.html?order_id={order_id}",
        },
      },
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Cashfree Response:", response.data);
    res.json({ success: true, payment_link: response.data.payment_link });
  } catch (err) {
    console.error("❌ Cashfree Error:", err.response?.data || err.message);
    res
      .status(500)
      .json({ success: false, error: err.response?.data || err.message });
  }
});

// 🟢 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
