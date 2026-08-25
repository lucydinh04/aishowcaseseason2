# V25 — Master Frame Layout Fix

## Root cause
The site had two conflicting desktop layout systems:
- original sections / Registration: 1180px
- later V4 override: 1360px site frame + 1440px nav frame

This made most sections and the fixed 3D artwork look too close to viewport edges.

## Fix
Registration is now the single layout reference:
- Master content width: 1180px
- Desktop gutter: max(32px, (viewport - 1180px) / 2)
- Tablet gutter: 24px
- Mobile gutter: 16px

Applied consistently to:
- Header / nav
- Hero
- Bối cảnh
- Mùa 1
- Điều kiện
- Giải thưởng
- BGK
- Registration

3D visual alignment:
- right-side visuals align to the form's right edge
- Criteria visual aligns to the form's left edge
- no artwork is anchored directly to viewport edges

Deploy:
1. Replace root `index.html`
2. Commit to `main`
3. Push origin
4. Wait for Vercel auto-deploy
5. Hard refresh
