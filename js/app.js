  /**
   * ============================================================
   *  app.js — AppController + DashboardController
   *  Camada de UI; depende de algorithms.js e observability.js
   * ============================================================
   */

  // ─────────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────────
  function setEl(id, val) {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  }

  function switchTab(tab, btn) {
    document.querySelectorAll('.tab-content').forEach(t => {
      t.classList.remove('active');
      t.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('tab-' + tab);
    if (el) { el.classList.add('active'); el.style.display = ''; }
    if (btn) btn.classList.add('active');
  }

  // ─────────────────────────────────────────────────────────────
  //  DashboardController — atualiza painéis de observabilidade
  // ─────────────────────────────────────────────────────────────
  const DashboardController = {
    update() {
      this._updateCounters();
      this._updateTimeline();
      this._updateCharts();
      this._updateSpanList();
      this._updateAnalysis();
    },

    _updateCounters() {
      const execs = otelMetrics.getAllCounters().filter(c => c.name === 'search.executions').reduce((a, c) => a + c.value, 0);
      const cmps  = otelMetrics.getAllCounters().filter(c => c.name === 'search.comparisons').reduce((a, c) => a + c.value, 0);
      const hits  = otelMetrics.getAllCounters().filter(c => c.name === 'search.occurrences').reduce((a, c) => a + c.value, 0);
      setEl('cnt-executions',  execs.toLocaleString());
      setEl('cnt-comparisons', cmps.toLocaleString());
      setEl('cnt-matches',     hits.toLocaleString());
      setEl('cnt-traces',      otelTracer.getSpans().length.toLocaleString());
    },

    _updateTimeline() {
      const spans = otelTracer.getSpans().filter(s => s.name.startsWith('search.') && s.name !== 'search.main');
      if (!spans.length) return;
      const maxDur = Math.max(...spans.map(s => parseFloat(s.durationMs || 0)));
      const colors = {
        'Naive (Força Bruta)': '#ef4444',
        'Rabin-Karp': '#f97316',
        'KMP (Knuth-Morris-Pratt)': '#00d4ff',
        'Boyer-Moore (Bad Character)': '#7c3aed',
      };
      const el = document.getElementById('trace-timeline');
      if (!el) return;
      el.innerHTML = spans.slice(-20).reverse().map(s => {
        const algo = s.attributes['algorithm.name'] || s.name;
        const dur  = parseFloat(s.durationMs || 0);
        const cmp  = s.attributes['result.total_comparisons'] || 0;
        const w    = maxDur > 0 ? (dur / maxDur * 100).toFixed(1) : 0;
        const color = colors[algo] || 'var(--accent)';
        return `
          <div class="trace-item">
            <span class="trace-algo">${algo}</span>
            <div class="trace-bar-wrap"><div class="trace-bar" style="width:${w}%;background:${color}"></div></div>
            <span class="trace-time">${dur.toFixed(3)} ms</span>
            <span class="trace-cmp">${Number(cmp).toLocaleString()} cmp</span>
          </div>`;
      }).join('');
    },

    _updateCharts() {
      const algos = ['naive', 'rabin_karp', 'kmp', 'boyer_moore'];
      const names = { naive: 'Naive', rabin_karp: 'Rabin-Karp', kmp: 'KMP', boyer_moore: 'Boyer-Moore' };
      const fullNames = {
        naive: 'Naive (Força Bruta)', rabin_karp: 'Rabin-Karp',
        kmp: 'KMP (Knuth-Morris-Pratt)', boyer_moore: 'Boyer-Moore (Bad Character)',
      };
      const colors = { naive: '#ef4444', rabin_karp: '#f97316', kmp: '#00d4ff', boyer_moore: '#7c3aed' };

      // Tempo
      const timeData = algos.map(a => {
        const fn = fullNames[a];
        const sp = otelTracer.getSpans().filter(s => s.attributes['algorithm.name'] === fn && s.endTime !== null);
        const avg = sp.length ? sp.reduce((s, x) => s + parseFloat(x.durationMs || 0), 0) / sp.length : 0;
        return { name: names[a], val: avg, color: colors[a] };
      });
      const maxTime = Math.max(...timeData.map(d => d.val), 0.001);
      const chartTime = document.getElementById('chart-time');
      if (chartTime) chartTime.innerHTML = timeData.map(d => `
        <div class="mbar-row">
          <span class="mbar-label">${d.name}</span>
          <div class="mbar-track"><div class="mbar-fill" style="width:${(d.val / maxTime * 100).toFixed(1)}%;background:${d.color}"></div></div>
          <span class="mbar-val">${d.val.toFixed(3)} ms</span>
        </div>`).join('');

      // Comparações
      const cmpData = algos.map(a => ({
        name: names[a],
        val: otelMetrics.getCounter('search.comparisons', { algorithm: fullNames[a] }),
        color: colors[a],
      }));
      const maxCmp = Math.max(...cmpData.map(d => d.val), 1);
      const chartCmp = document.getElementById('chart-cmp');
      if (chartCmp) chartCmp.innerHTML = cmpData.map(d => `
        <div class="mbar-row">
          <span class="mbar-label">${d.name}</span>
          <div class="mbar-track"><div class="mbar-fill" style="width:${(d.val / maxCmp * 100).toFixed(1)}%;background:${d.color}"></div></div>
          <span class="mbar-val">${d.val.toLocaleString()}</span>
        </div>`).join('');
    },

    _updateSpanList() {
      const spans = otelTracer.getSpans().slice(-30).reverse();
      const el = document.getElementById('span-list');
      if (!el || !spans.length) return;
      el.innerHTML = spans.map(s => {
        const dur = s.durationMs !== null ? `${parseFloat(s.durationMs).toFixed(3)} ms` : 'em andamento';
        const cls = s.status.code === 'OK' ? 'span-ok' : 'span-err';
        return `
          <div class="span-item">
            <span class="span-name">${s.name}</span>
            <span style="font-size:9px;color:var(--text-dim)">${s.traceId.substring(0, 8)}…</span>
            <span class="span-dur">${dur}</span>
            <span class="span-status ${cls}">${s.status.code}</span>
          </div>`;
      }).join('');

      const roots = otelTracer.getSpans().filter(s => !s.parentSpanId).slice(-1);
      if (roots.length) {
        const el2 = document.getElementById('trace-attrs');
        if (el2) el2.innerHTML = Object.entries(roots[0].attributes).map(([k, v]) => `
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);font-size:10px">
            <span style="color:var(--otel)">${k}</span>
            <span style="color:var(--text)">${String(v).substring(0, 60)}</span>
          </div>`).join('');
      }
    },

    _updateAnalysis() {
      const fullNames = {
        naive: 'Naive (Força Bruta)', rabin_karp: 'Rabin-Karp',
        kmp: 'KMP (Knuth-Morris-Pratt)', boyer_moore: 'Boyer-Moore (Bad Character)',
      };
      const meta = [
        { key: 'naive',       name: 'Naive',       theory: 'O(n×m)',     bestFor: 'Textos curtos' },
        { key: 'rabin_karp',  name: 'Rabin-Karp',  theory: 'O(n+m) médio', bestFor: 'Múltiplos padrões' },
        { key: 'kmp',         name: 'KMP',         theory: 'O(n+m)',     bestFor: 'Padrões com repetições' },
        { key: 'boyer_moore', name: 'Boyer-Moore', theory: 'O(n/m) melhor', bestFor: 'Textos longos' },
      ];
      const el = document.getElementById('theory-analysis');
      if (!el) return;
      el.innerHTML = meta.map(a => {
        const fn = fullNames[a.key];
        const sp = otelTracer.getSpans().filter(s => s.attributes['algorithm.name'] === fn && s.endTime !== null);
        if (!sp.length) return `<div style="color:var(--text-dim)">${a.name}: sem dados ainda</div>`;
        const avg = sp.reduce((s, x) => s + parseFloat(x.durationMs || 0), 0) / sp.length;
        const cmp = otelMetrics.getCounter('search.comparisons', { algorithm: fn });
        return `
          <div style="padding:6px;background:var(--bg2);border:1px solid var(--border);border-radius:4px">
            <div style="color:var(--accent);font-weight:700;font-size:10px">${a.name}</div>
            <div style="font-size:9px;color:var(--text-dim)">Teórico: <span style="color:var(--warning)">${a.theory}</span> · Melhor para: ${a.bestFor}</div>
            <div style="font-size:9px;color:var(--text)">Prático: ${avg.toFixed(3)} ms médio · ${cmp.toLocaleString()} comparações total</div>
          </div>`;
      }).join('');
    },
  };

  // ─────────────────────────────────────────────────────────────
  //  AppController — orquestra a UI
  // ─────────────────────────────────────────────────────────────
  class AppController {
    constructor() {
      this.fileInput     = document.getElementById('file-input');
      this.fileNameDisp  = document.getElementById('file-name');
      this.textArea      = document.getElementById('text-area');
      this.patternInput  = document.getElementById('pattern-input');
      this.algoSelect    = document.getElementById('algo-select');
      this.runAllBtn     = document.getElementById('run-all-btn');
      this.stepBtn       = document.getElementById('step-btn');
      this.resetBtn      = document.getElementById('reset-btn');
      this.logContainer  = document.getElementById('log-container');
      this.metricsPanel  = document.getElementById('metrics-panel');
      this.stepCounter   = document.getElementById('step-counter');
      this.progressBar   = document.getElementById('progress-bar');
      this.charHighlight = document.getElementById('char-highlight');
      this.algoInfo      = document.getElementById('algo-info');
      this.compareBtn    = document.getElementById('compare-btn');
      this.comparePanel  = document.getElementById('compare-panel');
      this.otelExportBtn = document.getElementById('otel-export-btn');
      this.otelStatus    = document.getElementById('otel-status');

      this._generator = null;
      this._allSteps  = [];
      this._step      = 0;
      this._context   = null;
      this._text      = '';
      this._pattern   = '';

      this._initEvents();
      this._updateAlgoInfo();
    }

    _initEvents() {
      this.fileInput.addEventListener('change', e => this._onFileChange(e));
      this.runAllBtn.addEventListener('click', () => this._runAll());
      this.stepBtn.addEventListener('click', () => this._runNextStep());
      this.resetBtn.addEventListener('click', () => this._reset());
      this.algoSelect.addEventListener('change', () => this._updateAlgoInfo());
      this.compareBtn.addEventListener('click', () => this._runCompare());
      this.otelExportBtn.addEventListener('click', () => this._exportOtel());

      const dz = document.getElementById('text-drop-zone');
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) this._readFile(f);
      });
    }

    _onFileChange(e) {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const invalid = files.find(f => !f.name.endsWith('.txt') && f.type !== 'text/plain');
      if (invalid) { this._toast(`"${invalid.name}" não é .txt`, 'error'); return; }
      let loaded = 0;
      const results = new Array(files.length);
      files.forEach((file, idx) => {
        const r = new FileReader();
        r.onload = ev => {
          results[idx] = ev.target.result; loaded++;
          if (loaded === files.length) {
            const totalKb = (files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1);
            this.textArea.value = files.length === 1
              ? results[0]
              : results.map((t, i) => `=== ${files[i].name} ===\n${t}`).join('\n\n');
            this.fileNameDisp.textContent = `📄 ${files.length === 1 ? files[0].name : files.length + ' arquivos'} (${totalKb} KB)`;
            this._toast(`${files.length} arquivo(s) carregado(s)!`, 'success');
            otelLogger.info('Arquivo(s) carregado(s)', { count: files.length, totalKb });
          }
        };
        r.readAsText(file);
      });
    }

    _readFile(file) {
      if (!file.name.endsWith('.txt') && file.type !== 'text/plain') { this._toast('Solte um .txt', 'error'); return; }
      const r = new FileReader();
      r.onload = ev => { this.textArea.value = ev.target.result; this.fileNameDisp.textContent = `📄 ${file.name}`; this._toast('Arquivo carregado!', 'success'); };
      r.readAsText(file);
    }

    _updateAlgoInfo() {
      const info = StrategyFactory[this.algoSelect.value]().getInfo();
      this.algoInfo.innerHTML = `
        <div class="info-card">
          <span class="info-name">${info.name}</span>
          <span class="info-complexity">Tempo: <b>${info.complexity}</b></span>
          <span class="info-complexity">Espaço: <b>${info.spaceComplexity}</b></span>
          <p class="info-desc">${info.description}</p>
        </div>`;
    }

    _validate() {
      const text = this.textArea.value, pattern = this.patternInput.value;
      if (!text.trim())           { this._toast('Insira um texto!', 'error'); return null; }
      if (!pattern.trim())        { this._toast('Insira o padrão!', 'error'); return null; }
      if (pattern.length > text.length) { this._toast('Padrão maior que o texto.', 'error'); return null; }
      return { text, pattern };
    }

    _reset() {
      this._generator = null; this._allSteps = []; this._step = 0;
      this.logContainer.innerHTML = '<span class="log-placeholder">Os passos aparecerão aqui...</span>';
      this.metricsPanel.innerHTML = ''; this.charHighlight.innerHTML = '';
      this.stepCounter.textContent = 'Passo: 0 / 0';
      this.progressBar.style.width = '0%';
      this.comparePanel.innerHTML = '';
      this.stepBtn.disabled = false; this.runAllBtn.disabled = false;
      if (this.otelStatus) this.otelStatus.style.display = 'none';
      this._toast('Resetado.', 'info');
    }

    _runAll() {
      const v = this._validate(); if (!v) return;
      this._reset();
      const { text, pattern } = v;
      if (this.otelStatus) this.otelStatus.style.display = 'inline-flex';
      this._context = new SearchContext(StrategyFactory[this.algoSelect.value]());
      const result = this._context.executeAll(text, pattern);
      this._allSteps = result.steps; this._text = text; this._pattern = pattern;

      this.logContainer.innerHTML = '';
      result.steps.forEach((step, idx) => this._renderStep(step, idx + 1));
      this._renderMetrics(result);
      this._renderHighlight(text, pattern, result.positions);
      this.stepCounter.textContent = `Passos: ${result.steps.length} / ${result.steps.length}`;
      this.progressBar.style.width = '100%';
      this.stepBtn.disabled = true;
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
      if (this.otelStatus) this.otelStatus.style.display = 'none';
      this._toast(`✅ ${result.occurrences} ocorrência(s) · Trace: ${result.traceId.substring(0, 8)}…`, 'success');
    }

    _initStepByStep() {
      const v = this._validate(); if (!v) return false;
      const { text, pattern } = v;
      this._context   = new SearchContext(StrategyFactory[this.algoSelect.value]());
      this._generator = this._context.executeStepByStep(text, pattern);
      this._allSteps  = []; this._step = 0;
      this.logContainer.innerHTML = ''; this.metricsPanel.innerHTML = ''; this.charHighlight.innerHTML = '';
      this._text = text; this._pattern = pattern;
      return true;
    }

    _runNextStep() {
      if (!this._generator) { if (!this._initStepByStep()) return; }
      const result = this._generator.next();
      if (result.done) {
        this._toast('Execução concluída!', 'success');
        this.stepBtn.disabled = true;
        if (this._allSteps.length) {
          const last  = this._allSteps[this._allSteps.length - 1];
          const found = this._allSteps.filter(s => s.found);
          const info  = this._context.getInfo();
          const sr = new SearchResult({
            algorithmName: info.name, timeMs: 'N/A (passo a passo)',
            totalComparisons: last.totalComparisons ?? 0, occurrences: found.length,
            positions: found.map(s => s.foundAt), theoreticalComplexity: info.complexity,
            spaceComplexity: info.spaceComplexity, textLength: this._text.length, patternLength: this._pattern.length,
          });
          this._renderMetrics(sr);
          this._renderHighlight(this._text, this._pattern, sr.positions);
        }
        return;
      }
      const step = result.value;
      this._allSteps.push(step); this._step++;
      this._renderStep(step, this._step);
      this.stepCounter.textContent = `Passo: ${this._step}`;
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    // ── Renderização ──────────────────────────────────────────
    _renderStep(step, idx) {
      const div = document.createElement('div');
      div.className = `log-step log-phase-${step.phase}`;
      if (step.found) div.classList.add('log-found');
      if (step.match === false && (step.phase === 'search' || step.phase === 'char_check')) div.classList.add('log-mismatch');
      if (step.match === true  && step.phase !== 'lps_init' && step.phase !== 'bc_init')    div.classList.add('log-match');

      let auxHtml = '';
      if (step.aux) {
        if (step.aux.lps) auxHtml += `<div class="aux-table"><span class="aux-label">LPS:</span>${this._renderArray(step.aux.lps)}</div>`;
        if (step.aux.badChar && Object.keys(step.aux.badChar).length) auxHtml += `<div class="aux-table"><span class="aux-label">Bad Char:</span>${this._renderBadChar(step.aux.badChar)}</div>`;
      }

      div.innerHTML = `
        <span class="step-num">#${idx}</span>
        <span class="step-phase">${this._phaseLabel(step.phase)}</span>
        <span class="step-msg">${step.message}</span>
        ${step.totalComparisons > 0 ? `<span class="step-cmp">∑${step.totalComparisons}</span>` : ''}
        ${auxHtml}`;
      this.logContainer.appendChild(div);
    }

    _phaseLabel(p) {
      return ({
        preprocess:'PRÉ', lps_init:'LPS-INIT', lps_build:'LPS-BUILD', lps_fallback:'LPS-BACK', lps_done:'LPS-FIM',
        bc_init:'BC-INIT', bc_build:'BC-BUILD', bc_done:'BC-FIM',
        hash_check:'HASH', char_check:'CHAR', search:'BUSCA', found:'MATCH!', done:'FIM',
      })[p] || (p || '').toUpperCase();
    }

    _renderArray(arr) {
      return arr.map((v, i) => `<span class="arr-cell"><span class="arr-idx">${i}</span><span class="arr-val">${v}</span></span>`).join('');
    }
    _renderBadChar(obj) {
      return Object.entries(obj).map(([k, v]) => `<span class="arr-cell"><span class="arr-idx">'${k}'</span><span class="arr-val">${v}</span></span>`).join('');
    }

    _renderMetrics(result) {
      const traceHtml = result.traceId
        ? `<div class="metric-card metric-wide" style="border-color:var(--otel)">
            <div class="metric-label">Trace ID (OpenTelemetry)</div>
            <div class="metric-value" style="font-size:10px;color:var(--otel)">${result.traceId} · span: ${result.spanId || 'N/A'}</div>
          </div>` : '';
      this.metricsPanel.innerHTML = `
        <div class="metric-grid">
          <div class="metric-card"><div class="metric-label">Algoritmo</div><div class="metric-value metric-algo">${result.algorithmName}</div></div>
          <div class="metric-card"><div class="metric-label">Tempo</div><div class="metric-value">${result.timeMs} ms</div></div>
          <div class="metric-card"><div class="metric-label">Comparações</div><div class="metric-value">${Number(result.totalComparisons).toLocaleString()}</div></div>
          <div class="metric-card"><div class="metric-label">Ocorrências</div><div class="metric-value metric-${result.occurrences > 0 ? 'found' : 'notfound'}">${result.occurrences}</div></div>
          <div class="metric-card"><div class="metric-label">|Texto| / |Padrão|</div><div class="metric-value">${result.textLength} / ${result.patternLength}</div></div>
          <div class="metric-card"><div class="metric-label">Complexidade Tempo</div><div class="metric-value metric-complexity">${result.theoreticalComplexity}</div></div>
          <div class="metric-card"><div class="metric-label">Complexidade Espaço</div><div class="metric-value metric-complexity">${result.spaceComplexity}</div></div>
          <div class="metric-card metric-wide"><div class="metric-label">Posições</div><div class="metric-value">${result.positions.length > 0 ? result.positions.join(', ') : '—'}</div></div>
          ${traceHtml}
        </div>`;
    }

    _renderHighlight(text, pattern, positions) {
      if (!text || !pattern) return;
      const posSet = new Set(positions);
      let html = '', i = 0, m = pattern.length;
      while (i < text.length) {
        if (posSet.has(i)) { html += `<mark class="hl-match">${this._esc(text.slice(i, i + m))}</mark>`; i += m; }
        else { html += `<span>${this._esc(text[i])}</span>`; i++; }
      }
      this.charHighlight.innerHTML = `<div class="hl-text">${html}</div>`;
    }

    _esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
    }

    _runCompare() {
      const v = this._validate(); if (!v) return;
      const { text, pattern } = v;
      this.comparePanel.innerHTML = '<div style="color:var(--text-dim);padding:14px 0">Executando comparação...</div>';
      setTimeout(() => {
        const results = ['naive', 'rabin_karp', 'kmp', 'boyer_moore'].map(k =>
          new SearchContext(StrategyFactory[k]()).executeAll(text, pattern)
        );
        const minCmp  = Math.min(...results.map(r => r.totalComparisons));
        const minTime = Math.min(...results.map(r => parseFloat(r.timeMs)));
        this.comparePanel.innerHTML = `
          <div class="compare-title">Comparativo · SearchResult por Algoritmo</div>
          <div class="compare-grid">
            ${results.map(r => `
              <div class="compare-card ${r.totalComparisons === minCmp ? 'compare-best' : ''}">
                <div class="compare-name">${r.algorithmName}</div>
                <div class="compare-row"><span>Tempo</span><b>${r.timeMs} ms</b></div>
                <div class="compare-row"><span>Comparações</span><b>${Number(r.totalComparisons).toLocaleString()}</b></div>
                <div class="compare-row"><span>Ocorrências</span><b>${r.occurrences}</b></div>
                <div class="compare-row"><span>Complexidade</span><b>${r.theoreticalComplexity}</b></div>
                <div class="compare-row"><span>Trace ID</span><b style="font-size:8px;color:var(--otel)">${r.traceId ? r.traceId.substring(0, 10) + '…' : '—'}</b></div>
                ${r.totalComparisons === minCmp ? '<div class="compare-badge">⚡ Menos comparações</div>' : ''}
                ${parseFloat(r.timeMs) === minTime ? '<div class="compare-badge" style="color:var(--success)">🚀 Mais rápido</div>' : ''}
              </div>`).join('')}
          </div>`;
        DashboardController.update();
        this._toast('Comparação concluída! Ver Dashboard.', 'otel');
      }, 50);
    }

    _exportOtel() {
      const json = otelExporter.export(otelTracer, otelMetrics, otelLogger);
      const a    = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
        download: 'otel-trace-export.json',
      });
      a.click(); URL.revokeObjectURL(a.href);

      const el = document.getElementById('trace-export');
      if (el) el.innerHTML = `
        <div style="color:var(--success);margin-bottom:6px">✅ Exportado!</div>
        <pre style="font-size:9px;color:var(--text-dim);max-height:200px;overflow:auto;background:var(--bg2);padding:8px;border-radius:4px;border:1px solid var(--border)">${json.substring(0, 1500)}${json.length > 1500 ? '\n...(truncado)' : ''}</pre>`;

      this._toast('📡 Trace OTLP/JSON exportado!', 'otel');
      otelLogger.info('Trace exportado em formato OTLP/JSON', { spans: otelTracer.getSpans().length });
    }

    _toast(msg, type = 'info') {
      const t = Object.assign(document.createElement('div'), { className: `toast toast-${type}`, textContent: msg });
      document.body.appendChild(t);
      setTimeout(() => t.classList.add('toast-visible'), 50);
      setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => t.remove(), 400); }, 3000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Init
  // ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Inicializa tabs
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    const first = document.getElementById('tab-app');
    if (first) { first.style.display = ''; first.classList.add('active'); }

    window.app = new AppController();
    otelLogger.info('StringSearch Visualizer N2 inicializado', { 'service.version': '2.0.0' });
    DashboardController.update();
  });
