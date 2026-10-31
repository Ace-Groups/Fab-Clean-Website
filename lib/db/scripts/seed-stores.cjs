const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://postgres:badxit-mewjyw-kaDga9@db.pxhydxsqtqpewmjfhhoh.supabase.co:5432/postgres",
});

async function main() {
  await client.connect();
  console.log("Connected to database");

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "address" text NOT NULL,
        "phone" text NOT NULL,
        "email" text,
        "latitude" real NOT NULL,
        "longitude" real NOT NULL,
        "coverage_radius_km" real DEFAULT 3 NOT NULL,
        "map_href" text,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "stores_slug_unique" UNIQUE("slug")
      );

      INSERT INTO "stores" (
        "slug", "name", "address", "phone", "email", "latitude", "longitude", "coverage_radius_km", "map_href", "sort_order", "is_active"
      ) VALUES 
      (
        'pollachi', 'Fab Clean - Pollachi', 'No 16, Venketaramana Round Road, opp. to HDFC Bank, Pollachi, Tamil Nadu 642002', '93630 59595', 'pollachi@myfabclean.com', 10.667749, 77.011954, 10.0, 'https://maps.app.goo.gl/hGJHdkEraCXsbsgD6', 1, true
      ),
      (
        'suleeshwaranpatti', 'Fab Clean - Suleeshwaranpatti', '162, Kottur Road, opp. to Makkal Marundhagam, near to Nandhini Mahal, Suleshwaranpatti, Pollachi, Tamil Nadu 642006', '93630 59595', 'suleeshwaranpatti@myfabclean.com', 10.639843, 77.007228, 9.0, 'https://maps.app.goo.gl/c5dGSpTPJnEvTGHNA', 2, true
      ),
      (
        'udumalpet', 'Fab Clean - Udumalaipettai', 'First floor, No 79/7, Main Rd, opp. to Indian Bank, Aishwarya Nagar, Gandhi Nagar, Udumalaipettai Municipality, Tamil Nadu 642154', '93630 59595', 'udumalpet@myfabclean.com', 10.583861, 77.254672, 10.0, 'https://maps.app.goo.gl/7Qpf2upZUZCaUSsz7', 3, true
      ),
      (
        'kinathukadavu', 'Fab Clean - Kenathukadavu', 'Krishnasamy puram, Vadaputhur, Tamil Nadu 642109', '93637 19595', 'kinathukadavu@myfabclean.com', 10.823342, 77.017809, 8.0, 'https://maps.app.goo.gl/GAqSWZrc1LtBHUb9A', 4, true
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        coverage_radius_km = EXCLUDED.coverage_radius_km,
        map_href = EXCLUDED.map_href,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active,
        updated_at = now();
    `);
    console.log("Stores table created and seeded successfully.");
  } catch (error) {
    console.error("Error executing query", error);
  } finally {
    await client.end();
  }
}

main();
