# Q2 Trip Cost Istanbul

A premium, mobile-first Progressive Web App to calculate realistic driving costs for an Audi Q2 between two locations in Istanbul, accounting for live fuel prices and route-specific road/tunnel/bridge tolls.

## Security & API Key Setup

This application strictly separates browser-facing code from secure server-side proxy code. You must create two distinct Google Cloud API keys.

**Do NOT commit your `.env.local` file.**

### 1. Browser-Side API Key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
Used for Places Autocomplete and Interactive Maps rendering.
* **Required APIs to Enable in Google Cloud:**
  * Places API (New or Legacy)
  * Maps JavaScript API
* **Security Restrictions:**
  * Application Restriction: **HTTP Referrers** (Restrict to your specific production/staging URLs, e.g., `https://yourdomain.com/*`).

### 2. Server-Side API Key (`GOOGLE_ROUTES_API_KEY`)
Used to securely compute traffic-aware routing and exact toll costs without exposing the key in network payloads.
* **Required APIs to Enable in Google Cloud:**
  * Routes API (Make sure you enable Routes API, not just Directions API)
* **Security Restrictions:**
  * Application Restriction: **IP Addresses** (Restrict to your specific server's IP address).

### Quota and Pricing Warning
> [!CAUTION]
> The Google Routes API uses a higher-priced SKU when calculating tolls (`extraComputations: ["TOLLS"]`). Please monitor your Google Cloud billing dashboard carefully to prevent unexpected charges.

## Configuration & Running the App

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Enter your obtained keys into `.env.local`.
3. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

## Verifying Live Data vs Demo Mode

You can toggle `NEXT_PUBLIC_DEMO_MODE="true"` or `"false"` in your `.env.local` file.
* **Demo Mode:** When set to `"true"`, a prominent orange "DEMO MODE ACTIVE" banner appears at the top of the app. Network requests to Google and the fuel scraper are bypassed in favor of hardcoded realistic mock data.
* **Live Mode:** When set to `"false"`, the banner is removed, and the app connects to Google Maps and the real server-side `/api/fuel` endpoint. Fuel cards will display the exact retrieval timestamp and source.

## Testing

Run unit tests via vitest:
```bash
npm run test
```
To build for production:
```bash
npm run build
npm start
```
