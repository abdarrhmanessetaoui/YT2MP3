# TuneTube Converter

A fast, free YouTube to MP3 and MP4 converter web application. Convert and download YouTube videos as high-quality audio (MP3) or video (MP4) files instantly. No registration required.

![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)

## Features

- **MP3 Conversion** — Extract audio from YouTube videos in up to 320kbps quality
- **MP4 Download** — Download YouTube videos in up to 1080p resolution
- **Multiple Quality Options** — Choose between highest, medium, or specific resolutions (720p, 360p)
- **Instant Download** — Files are delivered directly to your device
- **No Registration** — Use the converter without signing up
- **Free to Use** — No hidden fees or subscriptions

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** EJS templating, vanilla JavaScript
- **Video/Audio Processing:** yt-dlp, FFmpeg
- **Deployment:** Vercel / Render / Koyeb / Fly.io

## Project Structure

```
├── api/
│   └── index.js          # Express server & Vercel serverless function
├── views/
│   └── index.ejs         # Frontend template
├── public/
│   ├── css/
│   │   └── style.css     # Application styles
│   └── images/
│       └── youtube2mp3icon.png
├── downloads/            # Local download storage (ignored in production)
├── package.json
├── vercel.json           # Vercel deployment configuration
├── render.yaml           # Render deployment configuration
└── yt-dlp.exe            # Windows binary (Linux binary downloaded during build)
```

## How It Works

1. **User submits a YouTube URL** along with format (MP3/MP4) and quality preferences
2. **Server validates the URL** and extracts the video ID
3. **yt-dlp processes the video** using FFmpeg for format conversion
4. **Status polling** tracks conversion progress
5. **File streaming** delivers the final file to the user's browser
6. **Cleanup** removes the temporary file after download

## Local Development

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- FFmpeg (installed automatically via `ffmpeg-static`)

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
```

## Deployment

### Koyeb (Recommended — 100% Free, No Credit Card)

[Koyeb](https://www.koyeb.com) offers a free tier with no credit card required, perfect for this application.

**Deploy Steps:**
1. Push your code to GitHub
2. Sign up at [Koyeb.com](https://app.koyeb.com) (use GitHub login — no credit card needed)
3. Click **"Create App"** → **"GitHub"**
4. Select your repository
5. Koyeb will auto-detect the Node.js app
6. Set the **Start Command** to: `npm start`
7. Set the **Port** to: `10000`
8. Click **"Deploy"**

Koyeb will build and deploy your app. The free tier includes 2 services with 1GB RAM and supports long-running processes.

### Fly.io (100% Free, No Credit Card)

[Fly.io](https://fly.io) offers a free tier with 3 shared VMs and 160GB outbound transfer. No credit card required.

**Deploy Steps:**
1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up: `fly auth signup` (no credit card needed)
3. Launch the app: `fly launch`
4. Follow the prompts (Fly will auto-detect Node.js)
5. Deploy: `fly deploy`

### Render.com (Free Tier, Credit Card Required for Verification)

[Render.com](https://render.com) offers a free tier but requires a credit card for account verification.

**Deploy Steps:**
1. Push your code to GitHub
2. Sign up at [Render.com](https://render.com)
3. Click **"New +"** → **"Web Service"**
4. Select your repository
5. Configure:
   - **Build Command:** `npm install && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o yt-dlp && chmod a+rx yt-dlp`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Add environment variable: `NODE_ENV=production`
7. Click **"Create Web Service"**

### Vercel (Requires Pro Plan)

This project can also be deployed on [Vercel](https://vercel.com), but the free Hobby plan has a 10-second function timeout that is insufficient for video downloads. For reliable operation, upgrade to **Vercel Pro**.

#### Vercel Configuration

The [`vercel.json`](vercel.json) file configures:
- **Rewrites:** All routes are directed to the `/api` serverless function
- **Functions:** The `yt-dlp` binary is included in the deployment bundle
- **Build Script:** Downloads the Linux version of `yt-dlp` during the build process
- **Max Duration:** Set to 300 seconds (5 minutes) for Pro plan

#### Deploy Steps

1. Push your code to GitHub
2. Import the repository in the Vercel dashboard
3. Vercel will automatically detect the Node.js project and deploy it

No additional build settings are required — the `vercel.json` handles all configuration.

## API Endpoints

| Method | Endpoint       | Description                          |
|--------|----------------|--------------------------------------|
| POST   | `/api/start`   | Start video/audio conversion         |
| GET    | `/api/status`  | Poll conversion progress             |
| POST   | `/api/stream`  | Download the converted file          |
| GET    | `/`            | Render the converter frontend        |

## Scripts

| Command       | Description                          |
|---------------|--------------------------------------|
| `npm run dev` | Start development server with nodemon |
| `npm start`   | Start production server              |
| `npm test`    | Run tests (placeholder)              |

## License

ISC
