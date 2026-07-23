# Salesforce setup — Meridian

This is the one-time setup to connect the BFF to your Salesforce sandbox using
**standard objects** (Product2 / Pricebook / Order / OrderItem) and the
**Client Credentials** OAuth flow. Do the steps in order; each has a "why".
When you're done, we flip `DATA_SOURCE=salesforce` and verify.

> Tip: after each major section you can run `npm run sf:check` (once creds are in
> `server/.env`) to see exactly what's still missing.

---

## 1. Custom fields on **Product2**
Setup → Object Manager → **Product** → Fields & Relationships → **New**, for each:

| Field Label      | API Name             | Type              | Notes                         |
|------------------|----------------------|-------------------|-------------------------------|
| Origin           | `Origin__c`          | Text (120)        |                               |
| Roast            | `Roast__c`           | Picklist          | Values: `Light`,`Medium`,`Dark` |
| Tasting Notes    | `Tasting_Notes__c`   | Text (255)        | Stored semicolon-separated    |
| Process          | `Process__c`         | Text (60)         |                               |
| Altitude Meters  | `Altitude_Meters__c` | Number (6, 0)     |                               |
| Latitude         | `Latitude__c`        | Number (3, 6)     | Decimal degrees               |
| Longitude        | `Longitude__c`       | Number (3, 6)     | Decimal degrees               |
| Stock            | `Stock__c`           | Number (6, 0)     |                               |
| Weight Grams     | `Weight_Grams__c`    | Number (6, 0)     |                               |
| Accent           | `Accent__c`          | Text (10)         | Hex color, e.g. `#c98a3c`     |
| Image Path       | `Image_Path__c`      | Text (255)        | e.g. `/products/x.jpg`        |

The BFF reads field API names from this exact list ([server/src/sf/mappers.js](../server/src/sf/mappers.js)
`PRODUCT_FIELDS`). Salesforce derives the API name from the label (spaces →
underscores), so "Tasting Notes" becomes `Tasting_Notes__c`. If your names differ,
update `mappers.js` (and `seed.js`) to match, or rename the fields.

Give your integration user's profile **read access** to these fields (Field-Level
Security → Visible). *Why:* the BFF selects these columns; a missing/hidden field
makes the SOQL query fail.

## 2. Products, Standard Price Book, and prices
1. Setup → **Price Books** → make sure the **Standard Price Book** is **Active**.
2. Create the 8 products. **Two options:**
   - **Easy:** skip manual entry — after finishing §4 and §5, run `npm run seed`.
     It creates/updates all 8 `Product2` records **and** their standard
     `PricebookEntry` prices from the app's own catalog. Re-runnable.
   - **Manual:** create each `Product2` (App Launcher → Products → New), set
     `ProductCode` to the slug below, fill the custom fields, mark **Active**,
     then add a **Standard Price** on each.

   | ProductCode (slug)     | Name                        | Price (USD) |
   |------------------------|-----------------------------|-------------|
   | `yirgacheffe-koke`     | Koke, Yirgacheffe           | 22.00       |
   | `huila-la-esperanza`   | La Esperanza, Huila         | 19.50       |
   | `antigua-la-tacita`    | La Tacita, Antigua          | 20.50       |
   | `nyeri-gachatha`       | Gachatha AA, Nyeri          | 24.50       |
   | `gayo-takengon`        | Gayo Highlands, Aceh        | 18.50       |
   | `tarrazu-la-pastora`   | La Pastora, Tarrazú         | 21.50       |
   | `cerrado-fazenda`      | Fazenda do Sertão, Cerrado  | 16.50       |
   | `nyamasheke-kilimbi`   | Kilimbi, Nyamasheke         | 23.00       |

   *Why `ProductCode` = slug:* it's the app's stable product id; the BFF looks
   products up by it, so images/URLs keep working across environments.

## 3. Order plumbing
1. Create one **Account** named exactly **`Meridian Web Orders`** (App Launcher →
   Accounts → New). *Why:* standard Orders require an Account; guest web orders
   hang off this one. (Or let `npm run seed` create it.)
2. Add custom field on **Order**: `Total_Cents__c` — Number (12, 0). *Why:* stores
   the server-computed total in integer cents so the receipt matches exactly.
3. *(Optional)* Add `GuestEmail__c` (Email) on Order for later phases.

## 3b. Shopper accounts (login / signup)
Shoppers are stored as **Contacts**. Add one custom field:
- On **Contact**: `Password_Hash__c` — Text (255). *Why:* stores the bcrypt hash
  of the shopper's password (never plaintext, never sent to the browser).

Give the integration user create/read access to Contact and to this field.

The app is **standard-first** (see [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md)):
the order lifecycle uses the **standard `Status`** field and the merchandise
total is the standard **`TotalAmount`**. `sf:setup` therefore only (a) adds the
`Shipped` + `Cancelled` values to the standard `Status` picklist and (b) creates
the few custom fields with no standard equivalent, granting the Run-As user
access — no manual work:
```
cd server
npm run sf:setup     # adds Order.Status values Shipped, Cancelled;
                     # creates Shopper__c (Lookup→Contact), Guest_Email__c,
                     # Discount_Cents__c, Promo_Code__c, Shipping_Cents__c,
                     # Payment_Intent__c, Tracking_Number__c, and
                     # Account.Company_Domain__c + permission set + assignment
```
*(If your integration user can't modify metadata, add those Status picklist
values and custom fields manually, then grant the Run-As user access.)*

**B2B: company accounts (team buying).** A shopper can check "I'm buying for a
company" at signup and give a company name. No admin setup needed — teammates
are matched automatically by **work email domain** (`jane@acme.com` →
`acme.com`): the first signer from a domain creates a real Account
(`Company_Domain__c` = the domain), and later signups from the same domain join
it, sharing that Account's order history. Free email providers (gmail.com,
etc.) are rejected for company signup. See
[DEVELOPER_GUIDE.md §9b](DEVELOPER_GUIDE.md) for the full flow.

**Einstein "likely to reorder" (optional AI — separate from `sf:setup`).**
`sf:setup` creates the field `Account.Reorder_Likelihood__c`, but the AI model
that *fills it in* is trained by an admin in Salesforce Setup — there is no API
to create it. **The app works fine without this step**: the score is simply
null and the Company tab shows no badge until a model has scored the account.
To turn it on (requires an edition with **Einstein Prediction Builder** — this
org is Enterprise Edition, which has it):
1. Setup → **Einstein Prediction Builder** → **New Prediction**.
2. Predict on the **Account** object; set the field it writes to →
   **`Reorder Likelihood`** (`Reorder_Likelihood__c`).
3. Follow the wizard to choose what "reorder" means and which fields to learn
   from (order recency/frequency, etc.). The exact screens vary by Salesforce
   release, so follow the in-product guidance rather than a fixed script here.
4. **Enable & train.** Training is asynchronous and needs enough historical
   Order volume to be meaningful — a brand-new org won't produce useful scores
   until real orders accumulate.

Once trained, Salesforce writes a 0–100 score to the field on each Account; the
BFF reads it (`GET /api/account/company/insights`) and the Company tab shows a
"Likely to reorder" badge. No app deploy or code change needed — the field was
already there. See [DEVELOPER_GUIDE.md §9d](DEVELOPER_GUIDE.md).

**Order lifecycle — the merchant runs fulfillment in Salesforce, on the standard
`Status` field.** A paid order lands as `Status = Activated`. To advance it, open
the Order in Salesforce and change **`Status`** → `Shipped` (add a
`Tracking_Number__c`) → `Completed` (= delivered). The shopper's account page
reads `Status` back into a Paid → Shipped → Delivered timeline — no app deploy
needed. Cancelling (in the app or by setting `Status = Cancelled`) restores stock;
a cancelled paid order is treated as refunded.

**Payments** default to **mock** (offline, no keys — test cards 4242… succeed,
4000 00…02 declines). To use real Stripe test mode, `npm i stripe` and set in
`server/.env`:
```
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**State & Country picklists:** if your org has them enabled (this one does), the
BFF writes the ISO code fields (`ShippingCountryCode` / `ShippingStateCode`) at
checkout and Salesforce derives the text — no extra setup needed.

The **contact form** creates a standard **Case** — no setup at all.

Also set session env in `server/.env`:
```
SESSION_SECRET=<a long random string>
COOKIE_SECURE=false   # true in production over HTTPS
```

## 4. Connected App (Client Credentials flow)
Setup → **App Manager** → **New Connected App** (Create a Connected App):
1. Basic info: name `Meridian BFF`, contact email.
2. **Enable OAuth Settings**:
   - Callback URL: `https://login.salesforce.com/services/oauth2/callback`
     (required by the form; unused by this flow).
   - **Selected OAuth Scopes:** `Manage user data via APIs (api)` and
     `Perform requests at any time (refresh_token, offline_access)`.
   - ✅ **Enable Client Credentials Flow**.
3. Save. Then **Manage → Edit Policies**:
   - **Client Credentials Flow → Run As:** pick an integration user with a
     profile that can read Product2/Pricebook and create Order/OrderItem.
   - IP relaxation: "Relax IP restrictions" is easiest for a sandbox.
4. **Manage Consumer Details** → copy the **Consumer Key** and **Consumer Secret**.
   *Why "Run As":* Client Credentials has no interactive user, so the app acts as
   this fixed integration user.

> New Connected Apps can take a few minutes to activate before tokens issue.

## 5. Put credentials in `server/.env`
```bash
cd server
cp .env.example .env      # if you haven't already
```
Set:
```
DATA_SOURCE=salesforce
SF_LOGIN_URL=https://YOUR-DOMAIN.my.salesforce.com   # your My Domain — see note below
SF_CLIENT_ID=<Consumer Key>
SF_CLIENT_SECRET=<Consumer Secret>
SF_API_VERSION=61.0
SF_ACCOUNT_NAME=Meridian Web Orders
```
`.env` is git-ignored — never commit it.

> **Important — use your My Domain URL, not `login`/`test`.salesforce.com.**
> The Client Credentials flow only works against the org's My Domain host, e.g.
> `https://yourorg.my.salesforce.com` (Dev Edition: `…develop.my.salesforce.com`;
> sandbox: `…--name.sandbox.my.salesforce.com`). Find it under **Setup → My Domain**
> ("Current My Domain URL") or just copy the host from your browser while logged in.
> Using the generic login host returns `request not supported on this domain`.

## 6. Verify
```bash
cd server
npm run sf:check     # read-only readiness report
npm run seed         # optional: create/refresh the 8 products + prices
npm run sf:check     # should now be all green
```
Then restart the app (`npm run dev:all` from the repo root) and load it — the
catalog now comes from Salesforce, and checking out creates a real **Order** you
can open in Salesforce. The React UI is unchanged; only the BFF's data source
switched.

### Troubleshooting
- **`invalid_client` / auth fails:** wrong key/secret, or Client Credentials not
  enabled / no Run-As user, or the app hasn't finished activating.
- **`No such column X__c`:** a custom field is missing or not visible to the
  Run-As user's profile (§1 field-level security).
- **`sf:check` says no priced products:** run `npm run seed`, or add standard
  PricebookEntries (§2).
- **Sandbox vs Dev Edition:** sandboxes use `https://test.salesforce.com`; a
  Developer Edition org uses `https://login.salesforce.com`. Set `SF_LOGIN_URL`
  accordingly.
