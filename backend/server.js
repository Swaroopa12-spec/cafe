const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const port = Number(process.env.PORT) || 10000;
const productCatalog = {
  coffee: { name: 'Slow Drip Coffee', price: 160 },
  cappuccino: { name: 'Little Cappuccino', price: 190 },
  tea: { name: 'Classic Masala Chai', price: 110 },
  'green-tea': { name: 'Green Tea', price: 120 },
  'ginger-tea': { name: 'Fresh Ginger Tea', price: 130 },
  milkshake: { name: 'Berry Cloud Shake', price: 220 },
  'egg-puff': { name: 'Golden Egg Puff', price: 75 },
  'curry-puff': { name: 'Garden Curry Puff', price: 65 },
  'chocolate-cake': { name: 'Chocolate Daydream', price: 210 },
  cake: { name: 'Vanilla Berry Cake', price: 195 },
  biscuits: { name: 'Butter Biscuits', price: 80 },
  'black-tea': { name: 'A Cup of Black Tea', price: 95 },
};

const allowedOrigins = new Set([
  'https://cafe-theta-blush.vercel.app',
  ...(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',').map(value => value.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://localhost:5173',
]);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('This website origin is not allowed.'));
  },
}));

// Stripe requires the exact request bytes to verify webhook signatures.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Webhook is not configured.');
  }
  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Invalid webhook signature: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?on_conflict=stripe_session_id`, {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          stripe_session_id: session.id,
          customer_email: session.customer_details?.email || session.customer_email || null,
          total_amount: session.amount_total,
          currency: session.currency,
          payment_status: session.payment_status,
          fulfillment_type: session.metadata?.fulfillment_type || 'pickup',
          order_note: session.metadata?.order_note || null,
          customer_name: session.customer_details?.name || null,
          customer_phone: session.customer_details?.phone || null,
          fulfillment_status: 'new',
          items: lineItems.data.map(item => ({ name: item.description, quantity: item.quantity, total_amount: item.amount_total })),
        }),
      });
      if (!response.ok) {
        console.error('Could not save paid order:', response.status, await response.text());
        return res.status(500).send('Could not record order.');
      }
    } else {
      // Stripe remains the payment ledger when Supabase order storage is not configured.
      console.log(`Payment completed in Stripe: ${session.id} (${session.payment_status}).`);
    }
  }
  return res.json({ received: true });
});

app.use(express.json({ limit: '32kb' }));

app.get('/', (_req, res) => res.json({ service: 'Have A Time Cafe API', ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config', (_req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  return res.json({
    authEnabled: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    paymentsEnabled: Boolean(stripeKey && process.env.STRIPE_WEBHOOK_SECRET),
    paymentMode: stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : 'unknown',
    orderStorageEnabled: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
});
app.get('/api/menu', (_req, res) => res.json(Object.entries(productCatalog).map(([id, item]) => ({ id, ...item }))));

app.post('/api/checkout/session', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe payments are not configured.' });
  const origin = req.body?.origin;
  if (!allowedOrigins.has(origin)) return res.status(400).json({ error: 'Invalid checkout website.' });
  const requested = req.body?.items;
  const fulfillmentType = req.body?.fulfillmentType;
  if (!['dine_in', 'pickup'].includes(fulfillmentType)) {
    return res.status(400).json({ error: 'Choose dine-in or pickup for your order.' });
  }
  const orderNote = typeof req.body?.orderNote === 'string' ? req.body.orderNote.trim() : '';
  if (orderNote.length > 250) return res.status(400).json({ error: 'Order instructions must be 250 characters or fewer.' });
  if (!Array.isArray(requested) || requested.length < 1 || requested.length > 30) {
    return res.status(400).json({ error: 'Your cart is empty or invalid.' });
  }

  const quantities = new Map();
  for (const row of requested) {
    if (!row || typeof row.id !== 'string' || !productCatalog[row.id] || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 20) {
      return res.status(400).json({ error: 'Your cart contains an invalid item.' });
    }
    quantities.set(row.id, (quantities.get(row.id) || 0) + row.quantity);
  }
  if ([...quantities.values()].some(quantity => quantity > 20)) {
    return res.status(400).json({ error: 'The quantity of an item is too large.' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const items = [...quantities.entries()].map(([id, quantity]) => ({
      id, name: productCatalog[id].name, quantity, price: productCatalog[id].price,
    }));
    const email = typeof req.body.email === 'string' && req.body.email.length <= 254 ? req.body.email : undefined;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map(item => ({
        quantity: item.quantity,
        price_data: {
          currency: 'inr',
          unit_amount: item.price * 100,
          product_data: { name: item.name },
        },
      })),
      ...(email ? { customer_email: email } : {}),
      phone_number_collection: { enabled: true },
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled`,
      metadata: { source: 'have-a-time-cafe', fulfillment_type: fulfillmentType, order_note: orderNote },
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error.message);
    return res.status(502).json({ error: 'Could not start secure checkout. Please try again.' });
  }
});

app.get('/api/checkout/session/:sessionId', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Payments are not configured.' });
  if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(req.params.sessionId)) return res.status(400).json({ error: 'Invalid checkout session.' });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (session.metadata?.source !== 'have-a-time-cafe') return res.status(404).json({ error: 'Order not found.' });
    return res.json({ paid: session.payment_status === 'paid', complete: session.status === 'complete' });
  } catch (error) {
    console.error('Stripe checkout status error:', error.message);
    return res.status(502).json({ error: 'Could not verify payment.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error.message === 'This website origin is not allowed.') return res.status(403).json({ error: error.message });
  console.error('API error:', error.message);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(port, '0.0.0.0', () => console.log(`Have A Time API listening on ${port}`));

