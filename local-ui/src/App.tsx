import { useEffect, useMemo, useRef, useState } from 'react';

type SummarySimple = {
  title: string;
  source: string;
  extractedAt: string;
  highlights: {
    animation: {
      mainDurations: string[];
      mainEasings: string[];
      mainRecipes: string[];
    };
    palette: {
      semantic: Array<{ name: string; value: string }>;
      topPalette: Array<{ name: string; value: string; confidence: string }>;
    };
    borders: string[];
    paddings: string[];
  };
};

type BundleEntry = {
  mode: 'bundle' | 'legacy';
  domain: string;
  timestamp: string;
  path: string;
  files: string[];
  summary?: { simple?: SummarySimple };
};

type ExtractResponse = {
  ok: boolean;
  bundle: unknown;
  latest: BundleEntry | null;
};

type ExtractOptions = {
  darkMode: boolean;
  mobile: boolean;
  slow: boolean;
  strictSecurity: boolean;
  includeMotion: boolean;
  includeLayoutMap: boolean;
  browser: 'chromium' | 'firefox';
  maxPages: number;
  maxDepth: number;
  maxTimeMs: number;
  concurrency: number;
  noSandbox: boolean;
};

const DEFAULT_OPTIONS: ExtractOptions = {
  darkMode: false,
  mobile: false,
  slow: false,
  strictSecurity: true,
  includeMotion: true,
  includeLayoutMap: true,
  browser: 'chromium',
  maxPages: 8,
  maxDepth: 2,
  maxTimeMs: 180000,
  concurrency: 2,
  noSandbox: true,
};

function App() {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState<ExtractOptions>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<number | null>(null);

  const [bundles, setBundles] = useState<BundleEntry[]>([]);
  const [selected, setSelected] = useState<BundleEntry | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummarySimple | null>(null);

  const selectedFiles = useMemo(() => selected?.files || [], [selected]);

  function repairBrokenChars(input: string) {
    return input
      .replaceAll('Ã§', 'ç')
      .replaceAll('Ã£', 'ã')
      .replaceAll('Ã¡', 'á')
      .replaceAll('Ã©', 'é')
      .replaceAll('Ã³', 'ó')
      .replaceAll('Ãº', 'ú')
      .replaceAll('â€œ', '"')
      .replaceAll('â€\u009d', '"')
      .replaceAll('â€™', "'")
      .replaceAll('â€“', '-')
      .replaceAll('â€”', '-')
      .replaceAll('â€¦', '...')
      .replaceAll('âœ“', '✓')
      .replaceAll('âš ', '⚠')
      .replaceAll('â†³', '↳');
  }

  function clearProgressTimer() {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function startProgress() {
    clearProgressTimer();
    setProgress(6);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        const step = prev < 40 ? 7 : prev < 70 ? 4 : 2;
        return Math.min(92, prev + step);
      });
    }, 700);
  }

  function finishProgress() {
    clearProgressTimer();
    setProgress(100);
    window.setTimeout(() => setProgress(0), 1200);
  }

  async function loadBundles() {
    try {
      const res = await fetch('/api/extractions');
      const data = (await res.json()) as BundleEntry[];
      setBundles(data);
      if (!selected && data.length > 0) {
        setSelected(data[0]);
      }
    } catch (e) {
      setError(repairBrokenChars((e as Error).message));
    }
  }

  async function loadSummary(entry: BundleEntry) {
    setSelected(entry);
    setSelectedSummary(entry.summary?.simple || null);

    if (entry.mode !== 'bundle') return;

    try {
      const res = await fetch(`/api/extractions/${entry.domain}/${entry.timestamp}/summary`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.simple) {
        setSelectedSummary(data.simple as SummarySimple);
      }
    } catch {
      // Best effort
    }
  }

  async function runExtraction() {
    if (!url.trim()) {
      setError('Informe um site para extração.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Executando extração...');
    startProgress();

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), options }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(repairBrokenChars(body?.error || 'Falha na extração'));
      }

      const data = (await res.json()) as ExtractResponse;
      setStatus('Extração concluída com sucesso.');
      finishProgress();

      await loadBundles();
      if (data.latest) {
        await loadSummary(data.latest);
      }
    } catch (e) {
      clearProgressTimer();
      setProgress(0);
      setError(repairBrokenChars((e as Error).message));
      setStatus('');
    } finally {
      clearProgressTimer();
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBundles();
    return () => clearProgressTimer();
  }, []);

  return (
    <div className="page">
      <header className="header">
        <h1>Dembrandt Portainer UI</h1>
        <p>Extraia design system de um site e baixe os arquivos gerados.</p>
      </header>

      <section className="card">
        <h2>Nova Extração</h2>
        <div className="grid">
          <label>
            Site
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com"
            />
          </label>

          <label>
            Browser
            <select
              value={options.browser}
              onChange={(e) => setOptions({ ...options, browser: e.target.value as 'chromium' | 'firefox' })}
            >
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
            </select>
          </label>

          <label>
            Max pages
            <input
              type="number"
              value={options.maxPages}
              onChange={(e) => setOptions({ ...options, maxPages: Number(e.target.value || 0) })}
            />
          </label>

          <label>
            Max depth
            <input
              type="number"
              value={options.maxDepth}
              onChange={(e) => setOptions({ ...options, maxDepth: Number(e.target.value || 0) })}
            />
          </label>

          <label>
            Timeout (ms)
            <input
              type="number"
              value={options.maxTimeMs}
              onChange={(e) => setOptions({ ...options, maxTimeMs: Number(e.target.value || 0) })}
            />
          </label>

          <label>
            Concorrência
            <input
              type="number"
              value={options.concurrency}
              onChange={(e) => setOptions({ ...options, concurrency: Number(e.target.value || 0) })}
            />
          </label>
        </div>

        <div className="checks">
          {(
            [
              ['darkMode', 'Dark mode'],
              ['mobile', 'Mobile viewport'],
              ['slow', 'Slow mode'],
              ['strictSecurity', 'Strict security'],
              ['includeMotion', 'Incluir motion'],
              ['includeLayoutMap', 'Incluir layout map'],
              ['noSandbox', 'No sandbox (container)'],
            ] as Array<[keyof ExtractOptions, string]>
          ).map(([key, label]) => (
            <label key={key} className="check">
              <input
                type="checkbox"
                checked={Boolean(options[key])}
                onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="actions">
          <button onClick={runExtraction} disabled={loading}>
            {loading ? 'Extraindo...' : 'Executar Extração'}
          </button>
          <button className="secondary" onClick={loadBundles} disabled={loading}>
            Atualizar Lista
          </button>
        </div>

        {loading && (
          <div className="progress-wrap" aria-live="polite">
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <small>{progress}%</small>
          </div>
        )}

        {status && <p className="status ok">{repairBrokenChars(status)}</p>}
        {error && <p className="status error">{repairBrokenChars(error)}</p>}
      </section>

      <section className="split">
        <div className="card">
          <h2>Extrações Salvas</h2>
          {bundles.length === 0 && <p>Nenhuma extração encontrada.</p>}
          <ul className="list">
            {bundles.map((entry) => (
              <li key={`${entry.domain}-${entry.timestamp}-${entry.path}`}>
                <button
                  className={selected?.path === entry.path ? 'selected' : ''}
                  onClick={() => loadSummary(entry)}
                >
                  <strong>{entry.domain}</strong>
                  <span>{entry.timestamp}</span>
                  <small>{entry.mode}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Resumo</h2>
          {!selected && <p>Selecione uma extração.</p>}
          {selected && !selectedSummary && <p>Sem summary disponível.</p>}

          {selectedSummary && (
            <div className="summary">
              <p><strong>Fonte:</strong> {repairBrokenChars(selectedSummary.source)}</p>
              <p><strong>Extraído em:</strong> {selectedSummary.extractedAt}</p>

              <h3>Animação</h3>
              <p>Durations: {selectedSummary.highlights.animation.mainDurations.join(', ') || '-'}</p>
              <p>Easings: {selectedSummary.highlights.animation.mainEasings.join(', ') || '-'}</p>
              <p>Recipes: {selectedSummary.highlights.animation.mainRecipes.join(', ') || '-'}</p>

              <h3>Paleta</h3>
              <p>Semânticas: {selectedSummary.highlights.palette.semantic.map((c) => `${repairBrokenChars(c.name)}: ${c.value}`).join(' | ') || '-'}</p>
              <p>Top: {selectedSummary.highlights.palette.topPalette.map((c) => `${repairBrokenChars(c.name)}: ${c.value}`).join(' | ') || '-'}</p>

              <h3>Bordas</h3>
              <p>{selectedSummary.highlights.borders.join(' | ') || '-'}</p>

              <h3>Paddings</h3>
              <p>{selectedSummary.highlights.paddings.join(' | ') || '-'}</p>
            </div>
          )}

          {selected && selected.mode === 'bundle' && (
            <>
              <h2>Downloads</h2>
              <div className="downloads">
                {selectedFiles.map((file) => (
                  <a
                    key={file}
                    href={
                      file.includes('/')
                        ? `/api/download-file?domain=${encodeURIComponent(selected.domain)}&timestamp=${encodeURIComponent(selected.timestamp)}&file=${encodeURIComponent(file)}`
                        : `/api/download/${selected.domain}/${selected.timestamp}/${file}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {file}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
