# Trade Radar service

A single Node 24+ service collects NHL trade coverage, serves the mobile feed, and sends opt-in Expo push alerts. SQLite stores reports, source cursors, device subscriptions, delivery history, and push receipts. Run exactly one replica with a persistent disk; do not deploy this worker to ephemeral serverless functions.

## Run locally

From this directory:

```sh
npm ci
cp .env.example .env
# Fill in server-only credentials in .env.
node --env-file=.env index.mjs
npm test
```

`GET /health` is the health probe. `GET /trades` returns the feed and per-source health; `?team=TOR` filters it. The service still collects RSS when X is unconfigured and reports the missing X coverage explicitly.

## Sources and confidence

- **Elliotte Friedman, @FriedgeHNIC:** official X API user lookup and paginated timeline, checked approximately every 60 seconds. New posts are processed and eligible alerts dispatched before polling the slower feeds. Requires an X API bearer token with access to those endpoints. Polling is not instantaneous and API limits/outages can delay it.
- **Sportsnet NHL and Pro Hockey Rumors:** public RSS, every five minutes. Only headlines and source links are served; article bodies are not republished.
- **NHL official announcements:** verified reports submitted through the protected ingestion endpoint.

A keyword filter selects likely trade coverage. Team matching uses explicit names, cities, nicknames and abbreviations; player-only posts or unusual shorthand can be missed by team filters. All-teams coverage avoids that limitation. This first version does not offer player subscriptions.

Friedman's original posts can qualify as **Medium** immediately. Quotes, replies, posts with links, and visibly attributed reports stay **Low** until reviewed. This is a conservative heuristic, not a guarantee of original sourcing. Two **reviewed independent reporting origins about the same specific claim** yield **High**. Only a reviewed official announcement yields **Confirmed**. Verified denials override confidence and send a correction to users previously alerted. Reports lose confidence after 48 hours without fresh evidence and leave the feed after seven days.

Repeated URLs are deduplicated. An article explicitly linking to exactly one Friedman post is grouped with that post without being counted as independent evidence. Other reports stay separate until an editor assigns a shared `claimId`; matching player names alone must never merge different destinations or different trades. Use the original source headline and its teams for grouped reports. Multi-topic articles can still require editorial separation. These labels rate reporting evidence, not the probability of a completed trade; they are not calibrated percentages.

### Reviewed ingestion

`POST /reports`, with `Authorization: Bearer <TRADE_ADMIN_TOKEN>`, accepts up to 100 normalized reports. Source IDs are allowlisted in `model.mjs`, and source URLs must match their source's domain/account. Never put this admin token in the mobile application.

```json
[
  {
    "sourceId": "sportsnet",
    "url": "https://www.sportsnet.ca/nhl/article/actual-report-path/",
    "title": "Actual report headline",
    "publishedAt": "<ISO timestamp within the past 30 days>",
    "teams": ["TOR", "CGY"],
    "claimId": "specific-player-destination-and-trade-window",
    "originId": "actual-original-reporter",
    "independent": true,
    "status": "rumor"
  }
]
```

Use the **same `originId`** for articles quoting the same reporter, and `independent: false` for those copies. Use the same claim ID only after verifying the claim matches. Update an existing canonical URL to correct its evidence or mark a reviewed denial with `status: "denied"`. A confirmed record must use `sourceId: "nhl"`, an actual NHL URL, and `status: "confirmed"`. Polling never overwrites editorial corrections. High/Confirmed are intentionally unavailable without this review step.

## Deployment and mobile setup

1. Deploy from the repository root with `server/trades/Dockerfile`. Mount a persistent volume at `/data`, expose port 8787 through HTTPS, run one replica, and set the server credentials. Back up the SQLite database. Configure trusted-proxy rate limiting at the ingress; the in-process limiter uses the direct peer IP.
2. Set `EXPO_PUBLIC_TRADE_API_URL` to that HTTPS origin in the mobile build environment, including the EAS production environment. Restart Metro after changing the value. The app displays a disconnected state when no URL is set.
3. Build a new native app with the new `expo-notifications` and `expo-secure-store` plugins. Configure APNs credentials through EAS for iOS and FCM v1 for Android. An OTA JavaScript update alone cannot add these native modules.
4. Open **My Team → Trade Radar** or **Settings → Trade Radar & Alerts**. Enable alerts, choose a team/all teams and minimum confidence. The default is Medium, allowing Friedman-first alerts. Device permission is requested only after opting in. Credentials are stored in SecureStore, and subscription changes are acknowledged by the server before the UI confirms them.
5. Verify a real push on a physical device, including permission denial, opt-out, foreground display, cold-launch navigation, and token renewal. Unit tests mock push transport; a successful JS bundle does not establish APNs/FCM delivery.

Subscriptions use a random per-install bearer credential, hashed at rest on the server. Only that installation can modify its subscription. Tokens have exclusive owners; new credentials cannot take over an existing token. Reinstalls that lose their secure credential may require removal of the old token owner by an operator. Document push-token collection in the app's privacy disclosures before publishing.

Alerts are sent on threshold crossing or confidence upgrades, with no historical notification flood on first enable. Failed requests use bounded exponential backoff; accepted tickets persist across restarts, and receipts are checked after 15 minutes. Invalid devices are disabled. Expo acceptance is not a delivery guarantee; a crash after acceptance but before persistence can produce a duplicate. Source failures remain isolated. Logs never print API tokens or device tokens.

## References

- [X user timelines](https://docs.x.com/x-api/users/get-posts)
- [X user lookup](https://docs.x.com/x-api/users/lookup/introduction)
- [Expo push delivery and receipts](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Expo notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
