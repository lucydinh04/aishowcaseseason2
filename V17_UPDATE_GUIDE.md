# V17 Update

## GitHub / Vercel
Replace/push:
- `index.html`
- `ahamove_logo_white.png`

Changes:
- Header logo: orange icon + white Ahamove wordmark.
- Mandatory section snapping; Lenis disabled.
- Use Case description split into 4 required fields.
- Registration deadline: 11/09/2026.

## Google Apps Script
Replace:
- `apps-script/Code.gs`

Then:
1. Save.
2. Run `applySeason2FormUpdate()` once.
3. Deploy → Manage deployments → Edit → New version → Deploy.

The migration:
- sets FORM_DEADLINE = `2026-09-11 23:59:59`
- appends these columns at the END of Registrations:
  - `problem_statement`
  - `ai_workflow`
  - `actual_users`
  - `before_after_result`
- keeps all existing rows and old column positions intact.

No Vercel Environment Variable changes are needed.
