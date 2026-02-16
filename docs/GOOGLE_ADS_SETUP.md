# Google Ads API Setup (Rentals Ads)

To display Google Ads spend on `/rentals-ads`, configure the following.

## 1. Google Cloud Console

1. Create or select a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Ads API**: APIs & Services → Enable APIs → search "Google Ads API"
3. Create OAuth 2.0 credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application** (or Desktop if testing locally)
   - Add authorized redirect URIs if using a web app
   - Copy **Client ID** and **Client Secret**

## 2. Google Ads Developer Token

1. Sign in to [Google Ads](https://ads.google.com)
2. Go to **Tools & Settings** → **API Center**
3. Apply for a developer token (test tokens work for your own accounts)
4. Copy the **Developer Token**

## 3. OAuth Refresh Token

### Option A: Use the project script (recommended)

```bash
node scripts/generate-google-ads-refresh-token.mjs
```

Enter your Client ID and Client Secret when prompted. A browser window will open for authorization. After approving, the script prints your refresh token.

**Prerequisite:** In Google Cloud Console, add `http://127.0.0.1:8080/` to your OAuth client’s **Authorized redirect URIs**.

### Option B: OAuth 2.0 Playground

The Google Ads–specific playground URL returns 404. Use the general [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) instead:

1. Click the gear icon → **Use your own OAuth credentials**
2. Enter your Client ID and Client Secret
3. Add `https://developers.google.com/oauthplayground` to **Authorized redirect URIs** in Google Cloud Console
4. In **Step 1**, under "Input your own scopes", enter: `https://www.googleapis.com/auth/adwords`
5. Click **Authorize APIs** and sign in with the Google account that has access to your Ads account
6. In **Step 2**, click **Exchange authorization code for tokens**
7. Copy the **Refresh token**

## 4. Customer ID

- Your Google Ads Customer ID (e.g. `123-456-7890`)
- Find it in Google Ads: Tools → Setup → Account settings
- Use with or without dashes; the API normalizes it

## 5. Login Customer ID (Manager / MCC)

**Required if your account is a client under a Manager (MCC) account.** If you get `USER_PERMISSION_DENIED`, you must set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to your **Manager account’s** customer ID (not the client ID).

- Sign in to [Google Ads](https://ads.google.com)
- Use the account selector (top right) to switch to your **Manager account**
- Go to Tools → Setup → Account settings
- Copy the Manager account’s Customer ID

## 6. Environment Variables

Add to `.env.local`:

```
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
```

**If your account is under a Manager (MCC):**

```
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your-manager-account-id
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `USER_PERMISSION_DENIED` / "manager's customer id must be set" | Add `GOOGLE_ADS_LOGIN_CUSTOMER_ID` with your **Manager** account ID (not the client ID). |

### If you've set GOOGLE_ADS_LOGIN_CUSTOMER_ID but still get USER_PERMISSION_DENIED

1. **Verify the env var is loaded** – The Rentals Ads page shows debug info on error: `loginCustomerIdSet=true` means the var is set; `false` means it's not loading (e.g. Vercel needs a redeploy, or the var is in the wrong environment).

2. **Vercel** – After adding env vars, trigger a new deployment. Ensure the var is set for the environment you're testing (Production / Preview / Development).

3. **Correct IDs** – `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = Manager (MCC) account ID. `GOOGLE_ADS_CUSTOMER_ID` = the client account you're querying. Do not swap them.

4. **Developer token** – When using an MCC, the developer token must be from the **Manager** account (API Center in the Manager account).

5. **OAuth user** – The Google account used to generate the refresh token must have access to the Manager account. Sign in to [Google Ads](https://ads.google.com) with that account and confirm you can switch to the Manager account.

## Date Range

The API returns YTD spend by default. Use query params to override:

- `?from=2025-01-01&to=2025-01-31` for a custom range
