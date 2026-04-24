# Local Development Setup

## Quick Start

1. **Navigate to the project directory:**
   ```bash
   cd snorkel-report
   ```

2. **Start a local server** (choose one):

   ### Python (Built-in)
   ```bash
   python -m http.server 8000
   ```

   ### Node.js
   ```bash
   npx http-server
   ```

   ### Using VS Code Live Server
   - Install extension: "Live Server" by Ritwick Dey
   - Right-click `index.html` → "Open with Live Server"

3. **Open your browser:**
   - Navigate to `http://localhost:8000`

## Why You Need a Local Server

Modern browsers block CORS (Cross-Origin Resource Sharing) requests from local files. The API calls won't work if you simply open `index.html` directly in your browser.

## Development Workflow

1. Make changes to HTML/CSS/JS files
2. Browser auto-refreshes if using Live Server
3. Manually refresh if using `http.server`

## Testing Different Regions

Edit the `regions` array in the JavaScript files to test different coordinates for Oahu or add new locations.

## Mobile Testing

With the local server running, you can test on mobile devices:

1. Find your computer's IP address
   - Windows: `ipconfig` (IPv4 Address)
   - Mac/Linux: `ifconfig` (inet)

2. Visit: `http://YOUR_IP_ADDRESS:8000` on your mobile device

## Troubleshooting

**"XMLHttpRequest error" in console:**
- You need a local server, not file:// access
- Use Python, Node.js, or Live Server

**Charts not appearing:**
- Make sure Chart.js CDN is loaded
- Check browser console for errors (F12)

**No data loading:**
- Check internet connection
- Open browser console (F12) to see API error messages
- API services may be temporarily unavailable

## Production Deployment

To deploy this website:

1. **Static Hosting:** Upload to Netlify, Vercel, or GitHub Pages
2. **No backend needed:** All data comes from APIs
3. **No compilation required:** Works as-is

Recommended services:
- Netlify (easiest for static sites)
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
