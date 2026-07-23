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
- **Deployment:** Vercel

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

### Render.com (Recommended — 100% Free)

This project is fully configured for deployment on [Render.com](https://render.com) free tier. Render supports long-running Node.js processes without timeout restrictions, making it ideal for video conversion.

#### Prerequisites

- A GitHub account
- Your code pushed to a GitHub repository

#### Deploy Steps

1. **Push your code to GitHub** (if not already done)
2. **Sign up at [Render.com](https://render.com)** and connect your GitHub account
3. **Click "New +" → "Web Service"**
4. **Select your repository** from the list
5. **Configure the service:**
   - **Name:** `tunetube-converter` (or any name you prefer)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
6. **Add environment variable:**
   - Key: `NODE_ENV`
   - Value: `production`
7. **Click "Create Web Service"**

Render will automatically:
- Install dependencies
- Download the Linux `yt-dlp` binary during build (via `vercel-build` script)
- Start the server with `npm start`
- Provide a public URL (e.g., `https://tunetube-converter.onrender.com`)

#### Persistent Storage (Optional)

The free tier includes a 1GB persistent disk. The [`render.yaml`](render.yaml) file is included to configure a persistent disk for the `downloads/` folder, ensuring files survive server restarts.

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
