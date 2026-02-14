#!/usr/bin/env node
/**
 * Generates a Google Ads API refresh token.
 *
 * Prerequisites:
 * 1. Create OAuth credentials in Google Cloud Console:
 *    - APIs & Services → Credentials → Create Credentials → OAuth client ID
 *    - Application type: Desktop app (simplest)
 *    - Copy Client ID and Client Secret
 *
 * 2. For Desktop app: add http://127.0.0.1 to Authorized redirect URIs
 *    (or use a random port - this script uses 8080)
 *
 * Usage:
 *   node scripts/generate-google-ads-refresh-token.mjs
 *
 * Then enter your Client ID and Client Secret when prompted.
 */

import http from "http";
import { randomBytes } from "crypto";

const SCOPE = "https://www.googleapis.com/auth/adwords";

async function prompt(question) {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getAuthUrl(clientId, state, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForTokens(clientId, clientSecret, code, redirectUri) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

async function main() {
  console.log("\n=== Google Ads API Refresh Token Generator ===\n");
  console.log("You need OAuth credentials from Google Cloud Console:");
  console.log("  APIs & Services → Credentials → Create Credentials → OAuth client ID");
  console.log("  Use 'Desktop app' type. Add http://127.0.0.1:8080/ to redirect URIs.\n");

  const clientId = await prompt("Enter your OAuth Client ID: ");
  const clientSecret = await prompt("Enter your OAuth Client Secret: ");

  if (!clientId || !clientSecret) {
    console.error("Client ID and Client Secret are required.");
    process.exit(1);
  }

  const PORT = 8080;
  const redirectUri = `http://127.0.0.1:${PORT}/`;
  const state = randomBytes(16).toString("hex");
  const authUrl = getAuthUrl(clientId, state, redirectUri);

  console.log("\n1. Opening browser for authorization...");
  console.log("   If it doesn't open, paste this URL in your browser:\n");
  console.log(`   ${authUrl}\n`);
  console.log("2. Sign in with the Google account that has access to your Google Ads.");
  console.log("3. Approve the requested access.");
  console.log("   (Ensure http://127.0.0.1:8080/ is in Authorized redirect URIs)\n");

  const serverPromise = new Promise((resolve) => {
    const server = http.createServer();
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });

      // Ignore requests without OAuth params (e.g. favicon, preconnect)
      if (!code && !error) {
        res.end("<p>Waiting for authorization...</p>");
        return;
      }

      if (process.env.DEBUG) {
        console.error("[DEBUG] Callback received:", { hasCode: !!code, hasError: !!error, stateMatch: returnedState === state });
      }

      if (error) {
        res.end(`<p><b>Error:</b> ${error}</p><p>Check the console.</p>`);
        server.close();
        resolve({ error });
        return;
      }

      if (returnedState !== state) {
        if (code && process.env.SKIP_STATE_CHECK) {
          console.error("[Warning] State mismatch - attempting token exchange anyway (SKIP_STATE_CHECK=1)");
          res.end("<p>Exchanging token...</p>");
          server.close();
          resolve({ code });
          return;
        }
        res.end("<p>State mismatch. Close any duplicate tabs and run the script again. Or try SKIP_STATE_CHECK=1</p>");
        server.close();
        resolve({ error: "state_mismatch" });
        return;
      }

      if (code) {
        res.end("<p><b>Success!</b> Check the console for your refresh token.</p>");
        server.close();
        resolve({ code });
      } else {
        res.end("<p>Missing authorization code. Try again.</p>");
        server.close();
        resolve({ error: "invalid" });
      }
    });
    server.listen(PORT);
  });

  // Try to open browser (macOS/Windows/Linux)
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const { execSync } = await import("child_process");
    execSync(`${openCmd} "${authUrl}"`, { stdio: "ignore" });
  } catch {
    // Fallback: user pastes URL manually
  }

  const { code, error } = await serverPromise;
  if (error || !code) {
    console.error("Authorization failed or was cancelled.");
    process.exit(1);
  }

  const tokens = await exchangeCodeForTokens(clientId, clientSecret, code, redirectUri);
  console.log("\n=== Your refresh token ===\n");
  console.log(tokens.refresh_token);
  console.log("\nAdd this to your .env.local:");
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
