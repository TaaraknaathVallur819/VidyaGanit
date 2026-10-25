import pg from '../lib/db/node_modules/pg/lib/index.js';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

console.log("Connected to PostgreSQL database. Applying payments schema...");

await client.query(`
  -- Add Razorpay Route account ID to users
  ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS razorpay_route_account_id text;

  -- Create subscriptions table
  CREATE TABLE IF NOT EXISTS subscriptions (
    id serial PRIMARY KEY,
    owner_vidya_id text NOT NULL REFERENCES users(vidya_id) ON DELETE CASCADE,
    plan_code text NOT NULL,
    billing_cycle text NOT NULL,
    amount_paise integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'INR',
    status text NOT NULL DEFAULT 'Pending',
    provider_subscription_id text NOT NULL UNIQUE,
    provider_plan_id text NOT NULL,
    provider_payment_id text,
    current_start timestamp with time zone,
    current_end timestamp with time zone,
    cancel_at_cycle_end boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS subscriptions_owner_idx ON subscriptions(owner_vidya_id);
  CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

  -- Create payment_orders table
  CREATE TABLE IF NOT EXISTS payment_orders (
    id serial PRIMARY KEY,
    kind text NOT NULL,
    provider_order_id text NOT NULL UNIQUE,
    provider_payment_id text UNIQUE,
    provider_transfer_id text,
    payer_vidya_id text NOT NULL REFERENCES users(vidya_id) ON DELETE CASCADE,
    tutor_vidya_id text REFERENCES users(vidya_id) ON DELETE CASCADE,
    student_vidya_id text REFERENCES users(vidya_id) ON DELETE CASCADE,
    fee_payment_id integer REFERENCES fee_payments(id) ON DELETE RESTRICT,
    amount_paise integer NOT NULL,
    currency text NOT NULL DEFAULT 'INR',
    platform_fee_paise integer NOT NULL,
    gst_paise integer NOT NULL DEFAULT 0,
    transfer_amount_paise integer NOT NULL,
    status text NOT NULL DEFAULT 'Pending',
    receipt text NOT NULL UNIQUE,
    signature text,
    error_message text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS payment_orders_payer_idx ON payment_orders(payer_vidya_id);
  CREATE INDEX IF NOT EXISTS payment_orders_fee_idx ON payment_orders(fee_payment_id);
  CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status);
`);

console.log("Payments schema applied successfully!");
await client.end();
