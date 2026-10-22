import cors from "cors";
import express from "express";

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "https://cafe-3-jsja.onrender.com")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "32kb" }));

const menu = [
  { id: "coffee", name: "Slow Drip Coffee", category: "coffee", price: 160 },
  { id: "cappuccino", name: "Little Cappuccino", category: "coffee", price: 190 },
  { id: "tea", name: "Classic Masala Chai", category: "tea", price: 110 },
  { id: "green-tea", name: "Green Tea", category: "tea", price: 120 },
  { id: "ginger-tea", name: "Fresh Ginger Tea", category: "tea", price: 130 },
  { id: "milkshake", name: "Berry Cloud Shake", category: "treats", price: 220 },
  { id: "egg-puff", name: "Golden Egg Puff", category: "treats", price: 75 },
  { id: "curry-puff", name: "Garden Curry Puff", category: "treats", price: 65 },
  { id: "chocolate-cake", name: "Chocolate Daydream", category: "treats", price: 210 },
  { id: "cake", name: "Vanilla Berry Cake", category: "treats", price: 195 },
  { id: "biscuits", name: "Butter Biscuits", category: "treats", price: 80 },
  { id: "black-tea", name: "A Cup of Black Tea", category: "tea", price: 95 },
];

app.get("/", (_request, response) => {
  response.json({ name: "Have A Time API", status: "running" });
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/menu", (_request, response) => {
  response.json(menu);
});

app.use((error, _request, response, _next) => {
  console.error(error.message);
  response.status(500).json({ error: "The request could not be completed." });
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Have A Time API listening on port ${port}`);
});
