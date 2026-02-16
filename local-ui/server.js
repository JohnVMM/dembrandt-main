import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outputRoot = join(projectRoot, 'output');
const distDir = join(__dirname, 'dist');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const KNOWN_DOWNLOAD_FILES = [
  'summary.json',
  'tokens.light.json',
  'tokens.dark.json',
  'components.json',
  'layout.json',
  'motion.json',
  'assets.json',
  'dtcg.tokens.json',
  'report.json',
];

function safeSegment(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .trim();
}

function buildExtractArgs(url, options = {}) {
  const args = [join(projectRoot, 'index.js'), url, '--output-bundle', '--json-only'];

  if (options.darkMode) args.push('--dark-mode');
  if (options.mobile) args.push('--mobile');
  if (options.slow) args.push('--slow');
  if (options.strictSecurity) args.push('--strict-security');
  if (options.includeMotion !== false) args.push('--include-motion');
  if (options.includeLayoutMap !== false) args.push('--include-layout-map');

  if (options.browser && ['chromium', 'firefox'].includes(options.browser)) {
    args.push('--browser', options.browser);
  }

  if (Number.isFinite(options.maxPages)) args.push('--max-pages', String(options.maxPages));
  if (Number.isFinite(options.maxDepth)) args.push('--max-depth', String(options.maxDepth));
  if (Number.isFinite(options.maxTimeMs)) args.push('--max-time-ms', String(options.maxTimeMs));
  if (Number.isFinite(options.concurrency)) args.push('--concurrency', String(options.concurrency));

  // In containers this is commonly required.
  if (options.noSandbox !== false) {
    args.push('--no-sandbox');
  }

  return args;
}

async function listBundles() {
  if (!existsSync(outputRoot)) return [];

  const domains = await readdir(outputRoot, { withFileTypes: true });
  const bundles = [];

  for (const domainDir of domains) {
    if (!domainDir.isDirectory()) continue;

    const domainPath = join(outputRoot, domainDir.name);
    const entries = await readdir(domainPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const timestamp = entry.name;
        const bundlePath = join(domainPath, timestamp);
        const summaryPath = join(bundlePath, 'summary.json');
        const reportPath = join(bundlePath, 'report.json');

        let summary = null;
        let report = null;

        if (existsSync(summaryPath)) {
          try {
            summary = JSON.parse(await readFile(summaryPath, 'utf-8'));
          } catch {
            summary = null;
          }
        }

        if (existsSync(reportPath)) {
          try {
            report = JSON.parse(await readFile(reportPath, 'utf-8'));
          } catch {
            report = null;
          }
        }

        bundles.push({
          mode: 'bundle',
          domain: domainDir.name,
          timestamp,
          path: `${domainDir.name}/${timestamp}`,
          summary,
          report,
          files: KNOWN_DOWNLOAD_FILES.filter((f) => existsSync(join(bundlePath, f))),
        });
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        bundles.push({
          mode: 'legacy',
          domain: domainDir.name,
          timestamp: entry.name.replace('.json', ''),
          path: `${domainDir.name}/${entry.name}`,
          files: [entry.name],
        });
      }
    }
  }

  bundles.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return bundles;
}

app.get('/api/health', async (_req, res) => {
  await mkdir(outputRoot, { recursive: true });
  res.json({ ok: true, outputRoot, port: PORT });
});

app.get('/api/extractions', async (_req, res) => {
  try {
    const bundles = await listBundles();
    res.json(bundles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/extractions/:domain/:timestamp/summary', async (req, res) => {
  try {
    const domain = safeSegment(req.params.domain);
    const timestamp = safeSegment(req.params.timestamp);
    const summaryPath = join(outputRoot, domain, timestamp, 'summary.json');

    if (!existsSync(summaryPath)) {
      return res.status(404).json({ error: 'summary.json not found' });
    }

    const content = await readFile(summaryPath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/:domain/:timestamp/:file', async (req, res) => {
  try {
    const domain = safeSegment(req.params.domain);
    const timestamp = safeSegment(req.params.timestamp);
    const file = safeSegment(req.params.file);

    if (!KNOWN_DOWNLOAD_FILES.includes(file) && extname(file) !== '.json') {
      return res.status(400).json({ error: 'Unsupported file' });
    }

    const target = join(outputRoot, domain, timestamp, file);
    if (!existsSync(target)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(target, file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/extract', async (req, res) => {
  const { url, options = {} } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const args = buildExtractArgs(url, options);
  const child = spawn('node', args, {
    cwd: projectRoot,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('error', (error) => {
    res.status(500).json({ error: error.message });
  });

  child.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: stderr || `Extraction failed with code ${code}` });
    }

    try {
      const jsonStart = stdout.indexOf('{');
      const jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) {
        throw new Error('No JSON output found');
      }

      const bundle = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      const bundles = await listBundles();
      const latest = bundles[0] || null;

      res.json({
        ok: true,
        bundle,
        latest,
      });
    } catch (error) {
      res.status(500).json({ error: `Failed parsing extraction output: ${error.message}` });
    }
  });
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Dembrandt Web UI running on http://localhost:${PORT}`);
});
