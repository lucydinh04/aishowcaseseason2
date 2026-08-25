# V24 — Section content clarity fix

Root cause:
- Section content transition still used `autoAlpha: .18` + `filter: blur(5px)`.
- Mandatory scroll snap can fire leave/enter callbacks rapidly, leaving the active section stuck blurred.

Fix:
- Removed blur from section content transitions.
- Leaving a section no longer fades/blurs its content.
- Visible sections are force-restored to opacity 1 / y 0 / filter none.
- 3D artwork transitions remain unchanged.

Deploy:
1. Replace root `index.html`.
2. Commit to `main`.
3. Push origin.
4. Wait for Vercel auto-deploy.
5. Hard refresh the page (Cmd/Ctrl + Shift + R).
