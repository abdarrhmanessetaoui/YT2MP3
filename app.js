import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const execAsync = promisify(exec);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const jobs = new Map();

// OS specific configurations for Vercel
const isWindows = os.platform() === 'win32';
const ytDlpBinary = isWindows ? '.\\yt-dlp.exe' : path.join(__dirname, 'yt-dlp');
const downloadDir = isWindows ? path.join(process.cwd(), 'downloads') : '/tmp';

// Ensure local downloads directory exists
if (isWindows && !fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// --- STEP 1: START ---
app.post('/api/start', async (req, res) => {
    try {
        const { url, format, quality } = req.body;
        const videoIdMatch = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
        if (!videoIdMatch) return res.status(400).json({ error: 'Invalid URL' });

        const pid = videoIdMatch[1] + '-' + Date.now();
        const ext = format === 'mp4' ? 'mp4' : 'mp3';
        const outputPath = path.join(downloadDir, `${pid}.${ext}`);

        let ytFormat = '';
        if (format === 'mp4') {
            if (quality === 'best') ytFormat = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]';
            else if (quality === '720p') ytFormat = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]';
            else if (quality === '360p') ytFormat = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]';
        } else {
            ytFormat = 'bestaudio'; // yt-dlp will extract audio
        }

        let command = `${ytDlpBinary} --no-warnings -f "${ytFormat}" --ffmpeg-location "${ffmpegPath}" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoIdMatch[1]}"`;
        if (format === 'mp3') {
            const audioQuality = quality === 'best' ? '0' : '5'; // 0 is best, 5 is ~128kbps
            command += ` -x --audio-format mp3 --audio-quality ${audioQuality}`;
        }

        // Start yt-dlp job in background
        const job = execAsync(command)
            .then(async () => {
                // Get title
                const { stdout } = await execAsync(`${ytDlpBinary} --get-title "https://www.youtube.com/watch?v=${videoIdMatch[1]}"`);
                return { title: stdout.trim(), ext, filePath: outputPath };
            })
            .catch(e => {
                console.error(e);
                throw new Error('Failed to download video');
            });

        jobs.set(pid, { promise: job, status: 'processing' });

        // Update job status when done
        job.then(result => {
            jobs.set(pid, { status: 'ok', result });
        }).catch(err => {
            jobs.set(pid, { status: 'error', error: err.message });
        });

        res.json({ success: true, pid, title: 'Video' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- STEP 2: CHECK STATUS (POLLING) ---
app.get('/api/status', (req, res) => {
    const job = jobs.get(req.query.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.status === 'ok') {
        res.json({ progress: 1000, downloadUrl: `/api/stream?pid=${req.query.id}`, title: job.result.title, ext: job.result.ext });
    } else if (job.status === 'processing') {
        res.json({ progress: 500 });
    } else {
        res.status(500).json({ error: job.error });
    }
});

// --- STEP 3: STREAM FILE ---
app.post('/api/stream', (req, res) => {
    const { downloadUrl, title, ext } = req.body;
    const pid = new URL(downloadUrl, 'http://localhost').searchParams.get('pid');
    const job = jobs.get(pid);

    if (!job || job.status !== 'ok') return res.status(404).send("File not found");

    const safeTitle = (title || 'media').replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    const contentType = ext === 'mp4' ? 'video/mp4' : 'audio/mpeg';

    res.download(job.result.filePath, `${safeTitle}.${ext}`, (err) => {
        if (err) console.error("Error downloading file:", err);
        // Delete file after download
        fs.unlink(job.result.filePath, () => { });
        jobs.delete(pid);
    });
});

app.get('/', (req, res) => res.render("index"));

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

export default app;