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
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const jobs = new Map();
const jobsDir = '/tmp/jobs';

// OS specific configurations for Vercel
const isWindows = os.platform() === 'win32';
const ytDlpBinary = isWindows ? path.join(__dirname, '../yt-dlp.exe') : path.join(__dirname, '../yt-dlp');
const downloadDir = isWindows ? path.join(process.cwd(), 'downloads') : '/tmp';

console.log(`[${new Date().toISOString()}] [INIT] Server starting | platform:${os.platform()} | nodeEnv:${process.env.NODE_ENV} | ytDlp:${ytDlpBinary}`);

// Ensure directories exist
if (isWindows && !fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}
if (!fs.existsSync(jobsDir)) {
    fs.mkdirSync(jobsDir, { recursive: true });
}

// Helper: save job state to file (survives within same instance)
function saveJobState(pid, state) {
    try {
        fs.writeFileSync(path.join(jobsDir, `${pid}.json`), JSON.stringify(state));
    } catch (e) {
        console.error(`[${new Date().toISOString()}] [JOB:${pid}] Failed to save state:`, e.message);
    }
}

// Helper: load job state from file
function loadJobState(pid) {
    try {
        const data = fs.readFileSync(path.join(jobsDir, `${pid}.json`), 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
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

        // yt-dlp command optimized for Vercel reliability
        let command = `${ytDlpBinary} --no-warnings --no-playlist --no-check-certificates --buffer-size 64K -f "${ytFormat}" --ffmpeg-location "${ffmpegPath}" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoIdMatch[1]}"`;
        if (format === 'mp3') {
            const audioQuality = quality === 'best' ? '0' : '5'; // 0 is best, 5 is ~128kbps
            command += ` -x --audio-format mp3 --audio-quality ${audioQuality}`;
        }

        const startTime = Date.now();
        console.log(`[${new Date().toISOString()}] [JOB:${pid}] Starting download | format:${format} quality:${quality} | platform:${os.platform()} | nodeEnv:${process.env.NODE_ENV}`);

        // Start yt-dlp job in background
        const job = execAsync(command, { timeout: 300000 }) // 5 minute timeout for yt-dlp process
            .then(async () => {
                const elapsed = Date.now() - startTime;
                console.log(`[${new Date().toISOString()}] [JOB:${pid}] yt-dlp finished in ${elapsed}ms | getting title...`);
                // Get title
                const { stdout } = await execAsync(`${ytDlpBinary} --get-title "https://www.youtube.com/watch?v=${videoIdMatch[1]}"`);
                const totalElapsed = Date.now() - startTime;
                console.log(`[${new Date().toISOString()}] [JOB:${pid}] Complete | totalTime:${totalElapsed}ms | title:${stdout.trim()}`);
                const result = { title: stdout.trim(), ext, filePath: outputPath };
                saveJobState(pid, { status: 'ok', result, startTime });
                return result;
            })
            .catch(e => {
                const elapsed = Date.now() - startTime;
                const errorMsg = e.message || 'Unknown error';
                console.error(`[${new Date().toISOString()}] [JOB:${pid}] FAILED after ${elapsed}ms | error:${errorMsg}`);
                saveJobState(pid, { status: 'error', error: errorMsg, startTime });
                throw new Error(errorMsg);
            });

        const jobState = { promise: job, status: 'processing', startTime };
        jobs.set(pid, jobState);
        saveJobState(pid, jobState);

        // Update job status when done
        job.then(result => {
            jobs.set(pid, { status: 'ok', result, startTime });
            saveJobState(pid, { status: 'ok', result, startTime });
        }).catch(err => {
            jobs.set(pid, { status: 'error', error: err.message, startTime });
            saveJobState(pid, { status: 'error', error: err.message, startTime });
        });

        res.json({ success: true, pid, title: 'Video' });
    } catch (e) {
        console.error(`[${new Date().toISOString()}] [START] Error:`, e);
        res.status(500).json({ error: e.message || 'Failed to start download' });
    }
});

// --- STEP 2: CHECK STATUS (POLLING) ---
app.get('/api/status', (req, res) => {
    try {
        const jobId = req.query.id;
        let job = jobs.get(jobId);

        // Fallback to file-based state if in-memory job is missing (instance recycle)
        if (!job) {
            const fileState = loadJobState(jobId);
            if (fileState) {
                console.log(`[${new Date().toISOString()}] [STATUS:${jobId}] Recovered from file after instance recycle | status:${fileState.status}`);
                job = fileState;
                // Restore to in-memory map for subsequent polls
                jobs.set(jobId, job);
            }
        }

        if (!job) {
            console.log(`[${new Date().toISOString()}] [STATUS:${jobId}] Job not found — invalid ID or expired`);
            return res.status(404).json({ error: 'Job not found. The job may have expired or the server was restarted.' });
        }

        if (job.status === 'ok') {
            const elapsed = job.startTime ? Date.now() - job.startTime : 0;
            console.log(`[${new Date().toISOString()}] [STATUS:${jobId}] Complete | totalTime:${elapsed}ms`);
            const title = job.result?.title || 'Video';
            const ext = job.result?.ext || 'mp3';
            res.json({ progress: 1000, downloadUrl: `/api/stream?pid=${jobId}`, title, ext });
        } else if (job.status === 'processing') {
            const elapsed = job.startTime ? Date.now() - job.startTime : 0;
            console.log(`[${new Date().toISOString()}] [STATUS:${jobId}] Still processing | elapsed:${elapsed}ms`);
            res.json({ progress: 500 });
        } else {
            const elapsed = job.startTime ? Date.now() - job.startTime : 0;
            const errorMsg = job.error || 'Unknown error';
            console.log(`[${new Date().toISOString()}] [STATUS:${jobId}] Error | elapsed:${elapsed}ms | error:${errorMsg}`);
            res.status(500).json({ error: errorMsg });
        }
    } catch (e) {
        console.error(`[${new Date().toISOString()}] [STATUS] Unhandled error:`, e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- STEP 3: STREAM FILE ---
app.post('/api/stream', (req, res) => {
    const { downloadUrl, title, ext } = req.body;
    const pid = new URL(downloadUrl, 'http://localhost').searchParams.get('pid');
    let job = jobs.get(pid);

    // Fallback to file-based state
    if (!job || job.status !== 'ok') {
        const fileState = loadJobState(pid);
        if (fileState && fileState.status === 'ok') {
            job = fileState;
            jobs.set(pid, job);
        }
    }

    if (!job || job.status !== 'ok') {
        console.log(`[${new Date().toISOString()}] [STREAM:${pid}] File not found or job not complete`);
        return res.status(404).send("File not found");
    }

    const safeTitle = (title || 'media').replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    const contentType = ext === 'mp4' ? 'video/mp4' : 'audio/mpeg';

    try {
        const fileSize = fs.statSync(job.result.filePath).size;
        console.log(`[${new Date().toISOString()}] [STREAM:${pid}] Streaming file | size:${fileSize} bytes | type:${contentType}`);

        res.download(job.result.filePath, `${safeTitle}.${ext}`, (err) => {
            if (err) console.error(`[${new Date().toISOString()}] [STREAM:${pid}] Download error:`, err);
            else console.log(`[${new Date().toISOString()}] [STREAM:${pid}] Download completed successfully`);
            // Delete file after download
            try { fs.unlinkSync(job.result.filePath); } catch (e) { /* ignore */ }
            jobs.delete(pid);
            try { fs.unlinkSync(path.join(jobsDir, `${pid}.json`)); } catch (e) { /* ignore */ }
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] [STREAM:${pid}] File access error:`, err.message);
        res.status(404).send("File not found");
    }
});

app.get('/', (req, res) => res.render("index"));

// Start server if not on Vercel (Vercel handles server startup via serverless functions)
if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

export default app;