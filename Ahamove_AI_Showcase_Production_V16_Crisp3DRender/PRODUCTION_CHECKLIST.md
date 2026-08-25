# Production checklist

- [ ] Paste `Code.gs`, `EmailTemplate.html`, `appsscript.json` vào Apps Script
- [ ] Run `setupProduction()` và approve quyền
- [ ] Copy API secret
- [ ] Deploy Apps Script Web App → `/exec`
- [ ] Set Vercel env `APPS_SCRIPT_WEB_APP_URL`
- [ ] Set Vercel env `REGISTRATION_SHARED_SECRET`
- [ ] Redeploy Vercel
- [ ] Điền `Config!EVENT_SITE_URL`
- [ ] Điền `Config!ADMIN_EMAILS` nếu BTC cần notification
- [ ] Test cá nhân
- [ ] Test team 2
- [ ] Test team 3
- [ ] Test duplicate
- [ ] Test email confirmation
- [ ] Test mobile
- [ ] Confirm form deadline 21/09/2026 23:59:59
