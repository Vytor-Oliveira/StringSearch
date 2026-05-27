/**
 * ============================================================
 *  observability/otel.js — Implementação OpenTelemetry
 *
 *  Simula a API do OpenTelemetry SDK no browser.
 *  Em produção: substituir por @opentelemetry/sdk-web +
 *  exportador OTLP/HTTP para Jaeger, Zipkin ou Grafana Tempo.
 *
 *  Classes:
 *   - OtelSpan     → representa um span
 *   - OtelTracer   → cria e gerencia spans/traces
 *   - OtelMetrics  → contadores e histogramas
 *   - OtelLogger   → logs estruturados por severidade
 *   - OtelExporter → exportação em formato OTLP/JSON
 *
 *  Instâncias globais exportadas:
 *   - otelTracer
 *   - otelMetrics
 *   - otelLogger
 *   - otelExporter
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  Helper — gera ID hexadecimal aleatório
// ─────────────────────────────────────────────────────────────
function genId(bytes = 16) {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}

// ─────────────────────────────────────────────────────────────
//  OtelSpan — representa um span do OpenTelemetry
// ─────────────────────────────────────────────────────────────
class OtelSpan {
  constructor(name, traceId, parentSpanId = null) {
    this.name        = name;
    this.traceId     = traceId;
    this.spanId      = genId(8);
    this.parentSpanId = parentSpanId;
    this.startTime   = performance.now();
    this.endTime     = null;
    this.attributes  = {};
    this.events      = [];
    this.status      = { code: 'OK', message: '' };
  }

  setAttribute(key, value) { this.attributes[key] = value; return this; }
  setAttributes(obj)       { Object.assign(this.attributes, obj); return this; }

  addEvent(name, attrs = {}) {
    this.events.push({ name, attrs, time: performance.now() });
    return this;
  }

  setStatus(code, message = '') { this.status = { code, message }; return this; }

  end() { this.endTime = performance.now(); return this; }

  get durationMs() {
    return this.endTime !== null ? (this.endTime - this.startTime).toFixed(3) : null;
  }
}

// ─────────────────────────────────────────────────────────────
//  OtelTracer — gerencia traces e spans
// ─────────────────────────────────────────────────────────────
class OtelTracer {
  constructor() {
    this._spans     = [];
    this._listeners = [];
  }

  /**
   * Cria e inicia um novo span.
   * @param {string} name
   * @param {string|null} traceId — se null, gera um novo
   * @param {string|null} parentSpanId
   * @returns {OtelSpan}
   */
  startSpan(name, traceId = null, parentSpanId = null) {
    const span = new OtelSpan(name, traceId || genId(16), parentSpanId);
    this._spans.push(span);
    this._notify('span_start', span);
    return span;
  }

  /** Finaliza um span e notifica listeners. */
  endSpan(span) {
    span.end();
    this._notify('span_end', span);
    return span;
  }

  /** Registra um listener para eventos de span. */
  onSpan(fn) { this._listeners.push(fn); }

  _notify(event, span) { this._listeners.forEach(fn => fn(event, span)); }

  getSpans() { return [...this._spans]; }

  clear() { this._spans = []; }
}

// ─────────────────────────────────────────────────────────────
//  OtelMetrics — contadores e histogramas
// ─────────────────────────────────────────────────────────────
class OtelMetrics {
  constructor() {
    this._counters   = {};
    this._histograms = {};
  }

  /**
   * Incrementa um contador.
   * @param {string} name
   * @param {number} value
   * @param {object} labels
   */
  increment(name, value = 1, labels = {}) {
    const key = name + JSON.stringify(labels);
    if (!this._counters[key]) this._counters[key] = { name, labels, value: 0 };
    this._counters[key].value += value;
  }

  /**
   * Registra um valor em um histograma.
   * @param {string} name
   * @param {number} value
   * @param {object} labels
   */
  record(name, value, labels = {}) {
    const key = name + JSON.stringify(labels);
    if (!this._histograms[key]) this._histograms[key] = { name, labels, values: [] };
    this._histograms[key].values.push(value);
  }

  /** Retorna o valor atual de um contador. */
  getCounter(name, labels = {}) {
    return this._counters[name + JSON.stringify(labels)]?.value || 0;
  }

  getAllCounters() { return Object.values(this._counters); }

  /** Retorna estatísticas de um histograma (min, max, avg, p50, p95). */
  getHistogram(name, labels = {}) {
    const h = this._histograms[name + JSON.stringify(labels)];
    if (!h || !h.values.length) return null;
    const sorted = [...h.values].sort((a, b) => a - b);
    return {
      name, labels,
      count: sorted.length,
      min:   sorted[0],
      max:   sorted[sorted.length - 1],
      avg:   sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p50:   sorted[Math.floor(sorted.length * 0.5)],
      p95:   sorted[Math.floor(sorted.length * 0.95)],
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  OtelLogger — logs estruturados por severidade
// ─────────────────────────────────────────────────────────────
class OtelLogger {
  constructor() {
    this._logs      = [];
    this._listeners = [];
  }

  _log(severity, message, attrs = {}) {
    const entry = { timestamp: new Date().toISOString(), severity, message, attrs };
    this._logs.push(entry);
    this._listeners.forEach(fn => fn(entry));
    return entry;
  }

  /** @param {string} msg @param {object} attrs */
  info(msg, attrs = {})  { return this._log('INFO',  msg, attrs); }
  warn(msg, attrs = {})  { return this._log('WARN',  msg, attrs); }
  error(msg, attrs = {}) { return this._log('ERROR', msg, attrs); }
  debug(msg, attrs = {}) { return this._log('DEBUG', msg, attrs); }

  /** Registra um listener chamado a cada log emitido. */
  onLog(fn) { this._listeners.push(fn); }

  getLogs() { return [...this._logs]; }
}

// ─────────────────────────────────────────────────────────────
//  OtelExporter — exporta em formato OTLP/JSON
//  Compatível com Jaeger, Zipkin e Grafana Tempo via OTLP/HTTP
// ─────────────────────────────────────────────────────────────
class OtelExporter {
  /**
   * Gera o payload OTLP/JSON completo (spans + métricas + logs).
   * @param {OtelTracer}  tracer
   * @param {OtelMetrics} metrics
   * @param {OtelLogger}  logger
   * @returns {string} JSON formatado
   */
  export(tracer, metrics, logger) {
    const spans = tracer.getSpans().map(s => ({
      traceId:             s.traceId,
      spanId:              s.spanId,
      parentSpanId:        s.parentSpanId,
      name:                s.name,
      startTimeUnixNano:   Math.round(s.startTime * 1e6),
      endTimeUnixNano:     s.endTime !== null ? Math.round(s.endTime * 1e6) : null,
      durationMs:          s.durationMs,
      attributes:          s.attributes,
      events:              s.events,
      status:              s.status,
    }));

    return JSON.stringify({
      resourceSpans: [{
        resource: {
          attributes: {
            'service.name':    'string-search-visualizer',
            'service.version': '2.0.0',
            'telemetry.sdk':   'otel-browser-sim',
          },
        },
        scopeSpans: [{
          scope: { name: 'search-algorithms', version: '2.0.0' },
          spans,
        }],
      }],
      resourceMetrics: [{
        metrics: metrics.getAllCounters().map(c => ({
          name: c.name, labels: c.labels, value: c.value,
        })),
      }],
      resourceLogs: [{
        logs: logger.getLogs().map(l => ({ ...l })),
      }],
    }, null, 2);
  }
}

// ─────────────────────────────────────────────────────────────
//  Instâncias globais
// ─────────────────────────────────────────────────────────────
const otelTracer   = new OtelTracer();
const otelMetrics  = new OtelMetrics();
const otelLogger   = new OtelLogger();
const otelExporter = new OtelExporter();

// ─────────────────────────────────────────────────────────────
//  Listener automático → painel de logs no Dashboard
// ─────────────────────────────────────────────────────────────
otelLogger.onLog(entry => {
  const el = document.getElementById('otel-log');
  if (!el) return;
  // Remove placeholder
  if (el.children.length === 1 && el.children[0].tagName !== 'DIV') el.innerHTML = '';

  const ts      = entry.timestamp.substring(11, 23);
  const attrStr = Object.entries(entry.attrs).slice(0, 3).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');

  const div = document.createElement('div');
  div.className = 'otel-log-entry';
  div.innerHTML = `
    <span class="otel-ts">${ts}</span>
    <span class="otel-sev ${entry.severity}">${entry.severity}</span>
    <span class="otel-msg">${entry.message}</span>
    ${attrStr ? `<span class="otel-attrs">{${attrStr}}</span>` : ''}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
});
