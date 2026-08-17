/**
 * Seed realistic test data — 5 stores, 50 products, 4 riders — with LOGIN-ABLE
 * accounts, so the full order loop can be exercised with proper variety.
 *
 * Run from repo root:  node packages/supabase/seed/seed-test-data.mjs
 * Reset (delete all @fitxo.test data):  node packages/supabase/seed/seed-test-data.mjs --reset
 *
 * Uses the admin service-role key (only place it lives: apps/admin/.env.local).
 * Auth users are created via auth.admin.createUser so the handle_new_user trigger
 * (migration 015/029) auto-provisions public.users + a draft store (for managers)
 * or a riders row (for riders); we then approve/verify + populate. Idempotent:
 * re-running skips accounts that already exist and stores that already have products.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── env ─────────────────────────────────────────────────────────────────────
function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv(resolve(__dirname, "../../../apps/admin/.env.local"));
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/admin/.env.local");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = "FitxoTest#2026"; // one password for every test account
const RESET = process.argv.includes("--reset");

// ── small helpers ────────────────────────────────────────────────────────────
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rand = () => Math.random().toString(36).slice(2, 7);
const pick = (arr, i) => arr[i % arr.length];
const money = (n) => Math.round(n);

// Confirmed-working Unsplash fashion photo IDs (seen loading in the storefront).
const IMAGES = [
  "photo-1529139574466-a303027c1d8b",
  "photo-1524504388940-b1c1722653e1",
  "photo-1500648767791-00dcc994a43e",
  "photo-1507679799987-c73779587ccf",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1517841905240-472988babdf9",
  "photo-1495385794356-15371f348c31",
  "photo-1496747611176-843222e1e57c",
];
const imgUrl = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

const COLORS = [
  { color_name: "Black", color_hex: "#171717" },
  { color_name: "White", color_hex: "#f5f5f5" },
  { color_name: "Navy", color_hex: "#1e293b" },
  { color_name: "Olive", color_hex: "#556b2f" },
  { color_name: "Beige", color_hex: "#d8c3a5" },
  { color_name: "Maroon", color_hex: "#7b2d3b" },
  { color_name: "Sky", color_hex: "#7dd3fc" },
  { color_name: "Mustard", color_hex: "#d9890f" },
];

// ── stores + their product themes ────────────────────────────────────────────
const STORES = [
  {
    name: "Urban Threads", category: "Streetwear", city: "Pune", pincode: "411001",
    address: "12 Lane 5, Koregaon Park, Pune", phone: "9822000101",
    lat: 18.5362, lng: 73.8939, sizeType: "alpha", sizes: ["S", "M", "L", "XL"],
    products: ["Oversized Graphic Tee", "Cargo Joggers", "Boxy Fit Shirt", "Street Hoodie",
      "Relaxed Crew Sweatshirt", "Utility Overshirt", "Acid Wash Tee", "Drop-Shoulder Polo",
      "Colourblock Windcheater", "Ribbed Tank Top"],
  },
  {
    name: "Bella Ethnic", category: "Ethnic Wear", city: "Pune", pincode: "411004",
    address: "44 FC Road, Deccan Gymkhana, Pune", phone: "9822000202",
    lat: 18.5196, lng: 73.8410, sizeType: "alpha", sizes: ["S", "M", "L", "XL"],
    products: ["Anarkali Kurta Set", "Chikankari Kurta", "Bandhani Dupatta Set", "Silk Blend Sherwani",
      "Cotton Straight Kurta", "Festive Palazzo Set", "Nehru Jacket", "Embroidered Lehenga",
      "Handloom Saree", "Kurta Pyjama Set"],
  },
  {
    name: "Peak Active", category: "Activewear", city: "Pune", pincode: "411045",
    address: "8 Balewadi High St, Baner, Pune", phone: "9822000303",
    lat: 18.5679, lng: 73.7797, sizeType: "alpha", sizes: ["S", "M", "L", "XL"],
    products: ["Dry-Fit Training Tee", "Compression Tights", "Running Shorts", "Seamless Sports Bra",
      "Track Jacket", "Yoga Flare Pants", "Mesh Panel Tank", "Performance Polo",
      "Fleece Zip Hoodie", "Quick-Dry Joggers"],
  },
  {
    name: "Denim Depot", category: "Denim & Casuals", city: "Pune", pincode: "411014",
    address: "21 Phoenix Marketcity Rd, Viman Nagar, Pune", phone: "9822000404",
    lat: 18.5620, lng: 73.9160, sizeType: "numeric", sizes: ["30", "32", "34", "36"],
    products: ["Slim Fit Jeans", "Straight Leg Denim", "Distressed Skinny Jeans", "Denim Jacket",
      "Tapered Chinos", "Cargo Denim Shorts", "Raw Selvedge Jeans", "Bootcut Jeans",
      "Denim Overshirt", "Stretch Comfort Jeans"],
  },
  {
    name: "Little Stars", category: "Kids", city: "Pune", pincode: "411038",
    address: "6 Karve Rd, Kothrud, Pune", phone: "9822000505",
    lat: 18.5074, lng: 73.8077, sizeType: "alpha", sizes: ["S", "M", "L"],
    products: ["Cartoon Print Tee", "Dungaree Set", "Fleece Pyjama Set", "Party Frock",
      "Hooded Sweatshirt", "Cotton Shorts Combo", "Denim Pinafore", "Striped Romper",
      "Ethnic Kurta Set (Kids)", "Rainwear Jacket"],
  },
];

const RIDERS = [
  { name: "Ravi Kumar", email: "rider.ravi@fitxo.test", vehicle_type: "bike", vehicle_number: "MH 12 AB 1201", deliveries: 24, rating: 4.8 },
  { name: "Sana Shaikh", email: "rider.sana@fitxo.test", vehicle_type: "scooter", vehicle_number: "MH 14 CD 3402", deliveries: 11, rating: 4.9 },
  { name: "Arjun Patil", email: "rider.arjun@fitxo.test", vehicle_type: "bike", vehicle_number: "MH 12 EF 5603", deliveries: 37, rating: 4.7 },
  { name: "Neha Verma", email: "rider.neha@fitxo.test", vehicle_type: "cycle", vehicle_number: "MH 12 GH 7804", deliveries: 3, rating: 5.0 },
];

// ── auth user (idempotent) ───────────────────────────────────────────────────
async function ensureAuthUser(email, meta) {
  const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return { id: existing.id, created: false };
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: meta,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return { id: data.user.id, created: true };
}

// ── product builder ──────────────────────────────────────────────────────────
async function seedProduct(store, storeIdx, prodIdx, name) {
  const base = 799 + ((prodIdx * 137 + storeIdx * 53) % 24) * 100; // 799..3099
  const discounted = money(base * (0.7 + (prodIdx % 3) * 0.08));
  const slug = `${slugify(name)}-${slugify(store.name)}-${rand()}`;

  const { data: product, error: pErr } = await db.from("products").insert({
    store_id: store.id,
    name,
    slug,
    description: `${name} from ${store.name}. Try it on at your door — keep it only if you love it.`,
    short_description: `${store.category} · ${name}`,
    material: pick(["100% Cotton", "Cotton Blend", "Poly-Cotton", "Linen Blend", "Rayon"], prodIdx),
    fit_type: pick(["regular", "slim", "oversized", "relaxed"], prodIdx),
    base_price: base,
    discounted_price: discounted,
    is_active: true,
    is_featured: prodIdx < 2,
    tags: [store.category.toLowerCase(), "test-data"],
  }).select("id").single();
  if (pErr) throw new Error(`product ${name}: ${pErr.message}`);

  // 2–3 colours
  const colourCount = 2 + (prodIdx % 2);
  const colours = [];
  for (let c = 0; c < colourCount; c++) {
    const col = pick(COLORS, prodIdx + c);
    const { data: colour, error: cErr } = await db.from("product_colors").insert({
      product_id: product.id, color_name: col.color_name, color_hex: col.color_hex, sort_order: c,
    }).select("id").single();
    if (cErr) throw new Error(`colour: ${cErr.message}`);
    colours.push(colour.id);

    // variants: one per size, real stock
    const rows = store.sizes.map((size, si) => ({
      product_id: product.id,
      color_id: colour.id,
      size,
      size_type: store.sizeType,
      stock_qty: 4 + ((prodIdx + c + si) % 9), // 4..12
      sku: `${slugify(store.name).slice(0, 4).toUpperCase()}-${prodIdx}${c}${si}-${rand()}`.toUpperCase(),
    }));
    const { error: vErr } = await db.from("product_variants").insert(rows);
    if (vErr) throw new Error(`variants: ${vErr.message}`);
  }

  // primary image on the first colour + a second angle
  const img = pick(IMAGES, storeIdx * 10 + prodIdx);
  const { error: iErr } = await db.from("product_images").insert([
    { product_id: product.id, color_id: colours[0], image_url: imgUrl(img), angle: "front", is_primary: true, sort_order: 0, alt_text: name },
    { product_id: product.id, color_id: colours[0], image_url: imgUrl(pick(IMAGES, storeIdx * 10 + prodIdx + 3)), angle: "back", is_primary: false, sort_order: 1, alt_text: name },
  ]);
  if (iErr) throw new Error(`images: ${iErr.message}`);
  return product.id;
}

// ── reset ────────────────────────────────────────────────────────────────────
async function reset() {
  console.log("↺ Reset: deleting all @fitxo.test data …");
  const { data: users } = await db.from("users").select("id, email").like("email", "%@fitxo.test");
  const ids = (users ?? []).map((u) => u.id);
  // manager → store → products first (products RESTRICT store delete)
  const { data: mgrs } = await db.from("store_managers").select("store_id").in("user_id", ids);
  const storeIds = [...new Set((mgrs ?? []).map((m) => m.store_id))];
  if (storeIds.length) {
    const { data: prods } = await db.from("products").select("id").in("store_id", storeIds);
    const prodIds = (prods ?? []).map((p) => p.id);
    if (prodIds.length) await db.from("products").delete().in("id", prodIds); // cascades colours/variants/images
    await db.from("store_business_details").delete().in("store_id", storeIds);
    await db.from("store_managers").delete().in("store_id", storeIds);
    await db.from("stores").delete().in("id", storeIds);
  }
  for (const id of ids) await db.auth.admin.deleteUser(id).catch(() => {}); // cascades users/riders/payout_details
  console.log(`  deleted ${ids.length} accounts, ${storeIds.length} stores.`);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (RESET) { await reset(); return; }

  const creds = [];
  let productTotal = 0;

  for (let s = 0; s < STORES.length; s++) {
    const store = STORES[s];
    const email = `store.${slugify(store.name)}@fitxo.test`;
    const { id: managerId } = await ensureAuthUser(email, {
      name: `${store.name} Manager`, role: "store_manager", store_name: store.name,
    });

    // trigger created a draft store + link — find it
    const { data: link } = await db.from("store_managers").select("store_id").eq("user_id", managerId).maybeSingle();
    if (!link) throw new Error(`no store link for ${email} (trigger?)`);
    store.id = link.store_id;

    // approve + populate
    await db.from("stores").update({
      name: store.name, category: store.category, description: `${store.name} — ${store.category} in ${store.city}.`,
      contact_phone: store.phone, contact_email: email, address: store.address, city: store.city,
      pincode: store.pincode, lat: store.lat, lng: store.lng,
      is_active: true, is_verified: true, onboarding_status: "approved", reviewed_at: new Date().toISOString(),
    }).eq("id", store.id);

    await db.from("store_business_details").update({
      legal_name: `${store.name} Retail Pvt Ltd`, entity_type: "pvt_ltd",
      gst_number: `27AABCU${1000 + s}Q1Z${s}`, pan_number: `AABCU${1000 + s}Q`,
      bank_account_name: `${store.name} Retail Pvt Ltd`, bank_account_number: `50100${100000 + s}`,
      bank_ifsc: "HDFC0001234", upi_id: `${slugify(store.name)}@okhdfc`,
    }).eq("store_id", store.id);

    // products (skip if already seeded)
    const { count } = await db.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id);
    if ((count ?? 0) > 0) {
      console.log(`• ${store.name}: ${count} products already present — skipping product seed`);
      productTotal += count ?? 0;
    } else {
      for (let p = 0; p < store.products.length; p++) await seedProduct(store, s, p, store.products[p]);
      console.log(`✓ ${store.name}: ${store.products.length} products seeded`);
      productTotal += store.products.length;
    }
    creds.push({ role: "store", who: store.name, email, extra: `${store.category} · ${store.pincode}` });
  }

  for (const r of RIDERS) {
    const { id: userId } = await ensureAuthUser(r.email, { name: r.name, role: "rider" });
    await db.from("riders").update({
      is_verified: true, is_available: false, vehicle_type: r.vehicle_type,
      vehicle_number: r.vehicle_number, total_deliveries: r.deliveries, rating: r.rating,
    }).eq("user_id", userId);
    const { data: rider } = await db.from("riders").select("id").eq("user_id", userId).maybeSingle();
    if (rider) {
      await db.from("rider_payout_details").upsert({
        rider_id: rider.id, legal_name: r.name, pan_number: `ABCDE${1000 + r.deliveries}F`.slice(0, 10),
        payout_method: "upi", upi_id: `${slugify(r.name)}@okaxis`,
      }, { onConflict: "rider_id" });
    }
    console.log(`✓ rider ${r.name} (${r.vehicle_type}) verified`);
    creds.push({ role: "rider", who: r.name, email: r.email, extra: `${r.vehicle_type} · ${r.vehicle_number}` });
  }

  console.log(`\n───────────────────────────────────────────────`);
  console.log(`Seeded: ${STORES.length} stores · ${productTotal} products · ${RIDERS.length} riders`);
  console.log(`Password for ALL test accounts:  ${PASSWORD}`);
  console.log(`───────────────────────────────────────────────`);
  for (const c of creds) console.log(`  [${c.role.padEnd(5)}] ${c.email.padEnd(38)} ${c.who}  (${c.extra})`);
  console.log(`\nNote: products are orderable via /product/[id] and visible in store/admin panels.`);
  console.log(`They may not list on the customer /products or /search yet (static placeholders — customer rework).`);
}

main().catch((e) => { console.error("\n✗ Seed failed:", e.message); process.exit(1); });
