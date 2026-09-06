# Cloudflare Pages Deployment Guide

This project is fully optimized and configured for seamless deployment to **Cloudflare Pages**.

All image and PDF watermark removal operations run client-side in the browser using HTML5 Canvas, PDF.js, and pdf-lib. No external server or API keys are required for core functionality.

---

## 🚀 Quick Deploy Options

### Option 1: Git Integration (Recommended)

1. Push your repository to **GitHub** or **GitLab**.
2. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select this repository and configure the build settings:
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave blank)
4. Environment variables (optional):
   - `NODE_VERSION`: `20` (already pre-configured via `.node-version` and `.nvmrc`)
5. Click **Save and Deploy**.

---

### Option 2: Direct Upload via Wrangler CLI

Deploy directly from your terminal in seconds:

```bash
# 1. Build the production application
npm run build

# 2. Deploy the dist folder to Cloudflare Pages
npx wrangler pages deploy dist --project-name=gemini-watermark-remover
```

---

## ⚙️ Included Cloudflare Configurations

- **`public/_redirects`**: Configured with `/* /index.html 200` to support client-side Single Page Application (SPA) routing without 404 errors on page refresh.
- **`public/_headers`**:
  - Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
  - Long-term caching headers (`Cache-Control: public, max-age=31536000, immutable`) for static assets and web workers (`/assets/*`, `/pdf.worker.min.mjs`)
- **`wrangler.toml`**: Configured with `pages_build_output_dir = "dist"`.
- **`.node-version` & `.nvmrc`**: Pins the Node.js build version to Node 20.
