#!/usr/bin/env node
// kanban-motion renderer: headless Chrome -> raw frames -> ffmpeg. Frame-exact, so the
// preview and the exported video are identical.
//
//   node render.mjs preview --dir reel [--port 5173]   (live preview in your browser)
//   node render.mjs video  --dir reel --out out/reel.mp4 [--audio out/mix.wav]
//   node render.mjs stills --dir reel --t 1.2,4.5 [--only hook] --out out/wip
//   node render.mjs stills --dir reel --plates --out out/wip   (settled + mid-cut frame per plate)
//
// Options
//   --fps N          override the reel's fps
//   --samples N      motion-blur sub-frames per frame (1 = off, 4 = draft blur, 8-12 = final)
//   --shutter 0.5    fraction of the frame interval the shutter is open (0.5 = 180 degrees)
//   --scale 2        device scale factor (2 = 4K from a 1080p reel)
//   --from S --to S  render part of the timeline
//   --crf 17         x264 quality (lower = better)
//   --audio FILE     mux this audio (padded/cut to the picture)
//   --only NAME      draw only that plate
//
// Needs: `npm install` in this folder once (puppeteer-core), Chrome or Edge, ffmpeg on PATH.
// BROWSER_CHANNEL=msedge to use Edge, or BROWSER_PATH=/path/to/chrome.

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) o[k] = true;
    else { o[k] = v; i++; }
  }
  return o;
}

function serve(root, port = 0) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, url));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

async function launch() {
  const base = { headless: true, args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--font-render-hinting=none'] };
  if (process.env.BROWSER_PATH) return puppeteer.launch({ ...base, executablePath: process.env.BROWSER_PATH });
  const channels = [process.env.BROWSER_CHANNEL || 'chrome', 'msedge', 'chrome-beta'];
  let err;
  for (const channel of [...new Set(channels)]) {
    try { return await puppeteer.launch({ ...base, channel }); } catch (e) { err = e; }
  }
  throw new Error(`could not start Chrome or Edge (set BROWSER_PATH): ${err?.message}`);
}

const o = args(process.argv.slice(2));
const mode = o._[0] || 'video';
const dir = resolve(o.dir || '.');
if (!existsSync(join(dir, 'index.html'))) {
  console.error(`no index.html in ${dir} (pass --dir)`);
  process.exit(1);
}

if (mode === 'preview') {
  const s = await serve(dir, Number(o.port || 5173));
  console.log(`preview: http://127.0.0.1:${s.address().port}/  (?t=12.5 to start there, ?only=plate to solo one; Ctrl+C to stop)`);
  await new Promise(() => {});
}

const server = await serve(dir);
const browser = await launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') console.error('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[page error]', e.message));

const q = new URLSearchParams({ render: '1' });
if (o.only) q.set('only', o.only);
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?${q}`, { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
const meta = await page.evaluate(() => window.__meta);
const fps = Number(o.fps || meta.fps);
const scale = Number(o.scale || 1);
await page.setViewport({ width: meta.width, height: meta.height, deviceScaleFactor: scale });

const seek = (t) => page.evaluate(async (x) => { await window.__seek(x); }, t);
const grab = () => page.screenshot({ type: 'png', optimizeForSpeed: true, captureBeyondViewport: false });

try {
  if (mode === 'stills') {
    const out = resolve(o.out || 'out/stills');
    mkdirSync(out, { recursive: true });
    let times = [];
    if (o.plates) {
      for (const [i, p] of meta.plates.entries()) {
        if (p.end - p.start >= meta.duration - 0.01 && meta.plates.length > 1) continue; // backdrop
        times.push(p.start + (p.end - p.start) * 0.62);                 // settled
        if (i < meta.plates.length - 1) times.push(Math.max(0, p.end - 0.12)); // into the cut
      }
    } else {
      times = String(o.t || '0').split(',').map(Number);
    }
    for (const t of times) {
      await seek(t);
      const name = await page.evaluate((x) => window.__plateAt(x), t);
      const file = join(out, `${t.toFixed(2).padStart(6, '0')}_${name}.png`);
      await page.screenshot({ path: file, type: 'png' });
      console.log(file);
    }
  } else {
    const from = Number(o.from || 0), to = Math.min(Number(o.to || meta.duration), meta.duration);
    const samples = Math.max(1, Number(o.samples || 1));
    const shutter = Number(o.shutter || 0.5);
    const crf = String(o.crf || 17);
    const out = resolve(o.out || 'out/reel.mp4');
    mkdirSync(dirname(out), { recursive: true });
    const frames = Math.round((to - from) * fps);

    // Sub-frames are averaged by tmix, then one frame in `samples` is kept.
    const vf = [];
    if (samples > 1) vf.push(`tmix=frames=${samples}`, `select='eq(mod(n\\,${samples})\\,${samples - 1})'`, `setpts=N/${fps}/TB`);
    vf.push('scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p');
    const ff = [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * samples), '-c:v', 'png', '-i', '-',
      ...(o.audio ? ['-ss', String(from), '-i', resolve(o.audio)] : []),
      '-vf', vf.join(','), '-r', String(fps),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      ...(o.audio ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-af', 'apad', '-shortest'] : []),
      '-movflags', '+faststart', out,
    ];
    const enc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r, j) => enc.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited ${c}`)))));
    const write = (buf) => new Promise((r) => (enc.stdin.write(buf) ? r() : enc.stdin.once('drain', r)));

    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      for (let k = 0; k < samples; k++) {
        const off = samples > 1 ? shutter * ((k + 0.5) / samples - 0.5) : 0;
        await seek(Math.max(0, from + (i + off) / fps));
        await write(await grab());
      }
      if (i % fps === 0 || i === frames - 1) {
        const el = (Date.now() - t0) / 1000;
        process.stderr.write(`\r  frame ${i + 1}/${frames}  ${(((i + 1) / el) || 0).toFixed(1)} fps  ${el.toFixed(0)}s`);
      }
    }
    enc.stdin.end();
    await done;
    process.stderr.write('\n');
    console.log(out);
  }
} finally {
  await browser.close();
  server.close();
}
