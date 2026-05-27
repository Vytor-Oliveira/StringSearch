/**
 * ============================================================
 *  algorithms.js — Padrão Strategy + SearchResult
 *
 *  PADRÃO STRATEGY (GoF):
 *  Define uma família de algoritmos (SearchStrategy e subclasses),
 *  encapsula cada um e os torna intercambiáveis.
 *
 *  Participantes:
 *   - SearchStrategy    → Interface / Classe Base
 *   - NaiveSearch       → ConcreteStrategy
 *   - RabinKarpSearch   → ConcreteStrategy
 *   - KMPSearch         → ConcreteStrategy
 *   - BoyerMooreSearch  → ConcreteStrategy
 *   - SearchContext     → Context (usa a estratégia)
 *   - StrategyFactory   → Fábrica de estratégias
 *   - SearchResult      → Estrutura de retorno padronizada
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  SearchResult — Estrutura de retorno padronizada
// ─────────────────────────────────────────────────────────────
class SearchResult {
  constructor({
    algorithmName, timeMs, totalComparisons,
    occurrences, positions, theoreticalComplexity,
    spaceComplexity, textLength, patternLength,
    traceId = null, spanId = null, steps = [],
  }) {
    this.algorithmName        = algorithmName;
    this.timeMs               = timeMs;
    this.totalComparisons     = totalComparisons;
    this.occurrences          = occurrences;
    this.positions            = positions;
    this.theoreticalComplexity = theoreticalComplexity;
    this.spaceComplexity      = spaceComplexity;
    this.textLength           = textLength;
    this.patternLength        = patternLength;
    this.traceId              = traceId;
    this.spanId               = spanId;
    this.steps                = steps;
  }
}

// ─────────────────────────────────────────────────────────────
//  HELPER — cria objetos StepEvent padronizados
// ─────────────────────────────────────────────────────────────
function makeStep({
  algo, phase = 'search', textIdx = null, patIdx = null,
  match = null, skip = null, found = false, foundAt = null,
  message = '', aux = null, comparisons = 0, totalComparisons = 0,
}) {
  return { algo, phase, textIdx, patIdx, match, skip, found, foundAt, message, aux, comparisons, totalComparisons };
}

// ─────────────────────────────────────────────────────────────
//  SearchStrategy — Interface / Classe Base
// ─────────────────────────────────────────────────────────────
class SearchStrategy {
  /** @returns {{ name, complexity, spaceComplexity, description }} */
  getInfo() { throw new Error('getInfo() deve ser implementado pela subclasse.'); }

  /**
   * Generator que emite passos da busca (StepEvent) um a um.
   * @param {string} text
   * @param {string} pattern
   * @yields {StepEvent}
   */
  *search(text, pattern) { throw new Error('search() deve ser implementado pela subclasse.'); }
}

// ─────────────────────────────────────────────────────────────
//  CONCRETE STRATEGY 1 — NaiveSearch (Força Bruta)
// ─────────────────────────────────────────────────────────────
class NaiveSearch extends SearchStrategy {
  getInfo() {
    return {
      name: 'Naive (Força Bruta)',
      complexity: 'O(n × m)',
      spaceComplexity: 'O(1)',
      description: 'Compara o padrão com cada janela do texto, caractere a caractere. Sem pré-processamento.',
    };
  }

  *search(text, pattern) {
    const n = text.length, m = pattern.length;
    let totalComparisons = 0;
    const results = [];

    for (let i = 0; i <= n - m; i++) {
      let j = 0, wc = 0;
      while (j < m) {
        totalComparisons++; wc++;
        const ok = text[i + j] === pattern[j];
        yield makeStep({
          algo: 'naive', phase: 'search', textIdx: i + j, patIdx: j, match: ok,
          skip: ok && j === m - 1 ? 1 : !ok ? 1 : null,
          message: ok
            ? `✓ text[${i + j}]='${text[i + j]}' == pattern[${j}]='${pattern[j]}'`
            : `✗ text[${i + j}]='${text[i + j]}' ≠ pattern[${j}]='${pattern[j]}' → desloca 1`,
          comparisons: wc, totalComparisons, aux: { windowStart: i },
        });
        if (!ok) break;
        j++;
      }
      if (j === m) {
        results.push(i);
        yield makeStep({
          algo: 'naive', phase: 'found', textIdx: i, match: true, found: true, foundAt: i,
          message: `🎯 Padrão encontrado na posição ${i}!`,
          comparisons: wc, totalComparisons, aux: { windowStart: i },
        });
      }
    }
    yield makeStep({
      algo: 'naive', phase: 'done',
      message: results.length > 0
        ? `✅ ${results.length} ocorrência(s): [${results.join(', ')}]`
        : '❌ Padrão não encontrado.',
      totalComparisons, aux: { results },
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  CONCRETE STRATEGY 2 — RabinKarpSearch
// ─────────────────────────────────────────────────────────────
class RabinKarpSearch extends SearchStrategy {
  getInfo() {
    return {
      name: 'Rabin-Karp',
      complexity: 'O(n+m) médio / O(n×m) pior caso',
      spaceComplexity: 'O(1)',
      description: 'Usa hashing rolling para comparar janelas rapidamente. Verifica caracteres só em colisão de hash.',
    };
  }

  *search(text, pattern) {
    const n = text.length, m = pattern.length;
    const BASE = 31, MOD = 1_000_000_007n;
    let totalComparisons = 0;
    const results = [];
    let patHash = 0n, winHash = 0n, power = 1n;

    for (let i = 0; i < m; i++) {
      patHash = (patHash * BigInt(BASE) + BigInt(pattern.charCodeAt(i))) % MOD;
      winHash = (winHash * BigInt(BASE) + BigInt(text.charCodeAt(i))) % MOD;
      if (i > 0) power = (power * BigInt(BASE)) % MOD;
    }

    yield makeStep({
      algo: 'rk', phase: 'preprocess',
      message: `🔧 Pré-processamento: hash padrão = ${patHash}`,
      aux: { patHash: String(patHash), winHash: String(winHash) }, totalComparisons,
    });

    for (let i = 0; i <= n - m; i++) {
      const hm = winHash === patHash;
      yield makeStep({
        algo: 'rk', phase: 'hash_check', textIdx: i, patIdx: 0, match: hm,
        message: hm
          ? `🔍 [${i}..${i + m - 1}]: hash match → verificando chars...`
          : `⚡ [${i}..${i + m - 1}]: hash ≠ → descarta sem comparar`,
        aux: { winHash: String(winHash), patHash: String(patHash) }, totalComparisons,
      });

      if (hm) {
        let j = 0, wc = 0;
        while (j < m) {
          totalComparisons++; wc++;
          const ok = text[i + j] === pattern[j];
          yield makeStep({
            algo: 'rk', phase: 'char_check', textIdx: i + j, patIdx: j, match: ok,
            message: ok
              ? `✓ text[${i + j}]='${text[i + j]}'`
              : `✗ Colisão! text[${i + j}]≠pattern[${j}]`,
            comparisons: wc, totalComparisons,
          });
          if (!ok) break;
          j++;
        }
        if (j === m) {
          results.push(i);
          yield makeStep({
            algo: 'rk', phase: 'found', textIdx: i, found: true, foundAt: i,
            message: `🎯 Padrão encontrado na posição ${i}!`, totalComparisons,
          });
        }
      }

      if (i < n - m) {
        winHash = ((winHash - BigInt(text.charCodeAt(i)) * power) * BigInt(BASE)
          + BigInt(text.charCodeAt(i + m)) + MOD * BigInt(BASE + 1)) % MOD;
      }
    }
    yield makeStep({
      algo: 'rk', phase: 'done',
      message: results.length > 0
        ? `✅ ${results.length} ocorrência(s): [${results.join(', ')}]`
        : '❌ Padrão não encontrado.',
      totalComparisons, aux: { results },
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  CONCRETE STRATEGY 3 — KMPSearch
// ─────────────────────────────────────────────────────────────
class KMPSearch extends SearchStrategy {
  getInfo() {
    return {
      name: 'KMP (Knuth-Morris-Pratt)',
      complexity: 'O(n + m)',
      spaceComplexity: 'O(m)',
      description: 'Pré-processa o padrão para construir a tabela LPS. Evita retrocessos no texto.',
    };
  }

  *buildLPS(pattern) {
    const m = pattern.length;
    const lps = new Array(m).fill(0);
    let len = 0, i = 1;

    yield makeStep({
      algo: 'kmp', phase: 'lps_init',
      message: `🔧 Construindo LPS para "${pattern}"`,
      aux: { lps: [...lps] }, totalComparisons: 0,
    });

    while (i < m) {
      if (pattern[i] === pattern[len]) {
        len++; lps[i] = len;
        yield makeStep({
          algo: 'kmp', phase: 'lps_build', textIdx: i, patIdx: len - 1, match: true,
          message: `LPS[${i}] = ${len}`,
          aux: { lps: [...lps], i, len }, totalComparisons: 0,
        });
        i++;
      } else {
        if (len !== 0) {
          yield makeStep({
            algo: 'kmp', phase: 'lps_fallback',
            message: `mismatch → len: ${len} → ${lps[len - 1]}`,
            aux: { lps: [...lps], i, len }, totalComparisons: 0,
          });
          len = lps[len - 1];
        } else {
          lps[i] = 0;
          yield makeStep({
            algo: 'kmp', phase: 'lps_build', textIdx: i, patIdx: 0, match: false,
            message: `LPS[${i}] = 0`,
            aux: { lps: [...lps], i, len }, totalComparisons: 0,
          });
          i++;
        }
      }
    }
    yield makeStep({
      algo: 'kmp', phase: 'lps_done',
      message: `✅ LPS: [${lps.join(', ')}]`,
      aux: { lps: [...lps] }, totalComparisons: 0,
    });
    return lps;
  }

  *search(text, pattern) {
    const n = text.length, m = pattern.length;
    let totalComparisons = 0;
    const results = [];
    let lps = [];

    const lpsGen = this.buildLPS(pattern);
    let step = lpsGen.next();
    while (!step.done) { yield step.value; step = lpsGen.next(); }
    lps = step.value;

    let i = 0, j = 0;
    while (i < n) {
      totalComparisons++;
      const ok = text[i] === pattern[j];
      yield makeStep({
        algo: 'kmp', phase: 'search', textIdx: i, patIdx: j, match: ok,
        skip: !ok && j > 0 ? j - lps[j - 1] : !ok ? 1 : null,
        message: ok
          ? `✓ text[${i}]='${text[i]}'`
          : j > 0
            ? `✗ text[${i}]≠pattern[${j}] → LPS→${lps[j - 1]}`
            : `✗ text[${i}]≠pattern[${j}] → avança`,
        totalComparisons, aux: { lps: [...lps], i, j },
      });

      if (ok) { i++; j++; }
      if (j === m) {
        const pos = i - j;
        results.push(pos);
        yield makeStep({
          algo: 'kmp', phase: 'found', textIdx: pos, found: true, foundAt: pos,
          message: `🎯 Padrão encontrado na posição ${pos}!`,
          totalComparisons, aux: { lps: [...lps] },
        });
        j = lps[j - 1];
      } else if (!ok) {
        if (j !== 0) j = lps[j - 1]; else i++;
      }
    }
    yield makeStep({
      algo: 'kmp', phase: 'done',
      message: results.length > 0
        ? `✅ ${results.length} ocorrência(s): [${results.join(', ')}]`
        : '❌ Padrão não encontrado.',
      totalComparisons, aux: { results, lps },
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  CONCRETE STRATEGY 4 — BoyerMooreSearch
// ─────────────────────────────────────────────────────────────
class BoyerMooreSearch extends SearchStrategy {
  getInfo() {
    return {
      name: 'Boyer-Moore (Bad Character)',
      complexity: 'O(n/m) melhor / O(n×m) pior caso',
      spaceComplexity: 'O(σ) — tamanho do alfabeto',
      description: 'Pré-processa com tabela Bad Character. Compara da direita para a esquerda com saltos maiores.',
    };
  }

  *buildBadChar(pattern) {
    const badChar = {}, m = pattern.length;
    yield makeStep({
      algo: 'bm', phase: 'bc_init',
      message: `🔧 Construindo Bad Character para "${pattern}"`,
      aux: { badChar: {} }, totalComparisons: 0,
    });
    for (let i = 0; i < m - 1; i++) {
      badChar[pattern[i]] = i;
      yield makeStep({
        algo: 'bm', phase: 'bc_build', patIdx: i,
        message: `badChar['${pattern[i]}'] = ${i}`,
        aux: { badChar: { ...badChar } }, totalComparisons: 0,
      });
    }
    yield makeStep({
      algo: 'bm', phase: 'bc_done',
      message: `✅ Bad Character pronto`,
      aux: { badChar: { ...badChar } }, totalComparisons: 0,
    });
    return badChar;
  }

  *search(text, pattern) {
    const n = text.length, m = pattern.length;
    let totalComparisons = 0;
    const results = [];
    let badChar = {};

    const bcGen = this.buildBadChar(pattern);
    let step = bcGen.next();
    while (!step.done) { yield step.value; step = bcGen.next(); }
    badChar = step.value;

    let i = 0;
    while (i <= n - m) {
      let j = m - 1, wc = 0;
      while (j >= 0) {
        totalComparisons++; wc++;
        const ok = text[i + j] === pattern[j];
        yield makeStep({
          algo: 'bm', phase: 'search', textIdx: i + j, patIdx: j, match: ok,
          message: ok ? `✓ text[${i + j}]='${text[i + j]}'` : `✗ text[${i + j}]≠pattern[${j}]`,
          comparisons: wc, totalComparisons, aux: { windowStart: i, badChar: { ...badChar } },
        });
        if (!ok) break;
        j--;
      }
      if (j < 0) {
        results.push(i);
        yield makeStep({
          algo: 'bm', phase: 'found', textIdx: i, found: true, foundAt: i,
          message: `🎯 Padrão encontrado na posição ${i}!`, totalComparisons,
        });
        i++;
      } else {
        const skip = Math.max(1, j - (badChar[text[i + j]] ?? -1));
        yield makeStep({
          algo: 'bm', phase: 'search', textIdx: i + j, match: false, skip,
          message: `→ Bad Char: '${text[i + j]}' → salta ${skip}`,
          comparisons: wc, totalComparisons,
        });
        i += skip;
      }
    }
    yield makeStep({
      algo: 'bm', phase: 'done',
      message: results.length > 0
        ? `✅ ${results.length} ocorrência(s): [${results.join(', ')}]`
        : '❌ Padrão não encontrado.',
      totalComparisons, aux: { results },
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  SearchContext — usa a estratégia
// ─────────────────────────────────────────────────────────────
class SearchContext {
  constructor(strategy) { this._strategy = strategy; }
  setStrategy(strategy) { this._strategy = strategy; }
  getInfo() { return this._strategy.getInfo(); }

  /**
   * Executa completamente e retorna SearchResult instrumentado com OTEL.
   * @param {string} text
   * @param {string} pattern
   * @returns {SearchResult}
   */
  executeAll(text, pattern) {
    const info = this._strategy.getInfo();
    const traceId = genId(16);

    // Span raiz
    const rootSpan = otelTracer.startSpan(`search.${info.name}`, traceId);
    rootSpan.setAttributes({
      'algorithm.name': info.name,
      'algorithm.complexity': info.complexity,
      'text.length': text.length,
      'pattern.length': pattern.length,
      'pattern.value': pattern.substring(0, 50),
    });

    otelLogger.info(`Iniciando busca: ${info.name}`, { algorithm: info.name, textLen: text.length, patternLen: pattern.length });

    const steps = [];
    const start = performance.now();

    const preSpan = otelTracer.startSpan('preprocess', traceId, rootSpan.spanId);
    let inSearch = false, searchSpan = null;

    try {
      for (const step of this._strategy.search(text, pattern)) {
        steps.push(step);
        if (!inSearch && (step.phase === 'search' || step.phase === 'hash_check' || step.phase === 'char_check')) {
          otelTracer.endSpan(preSpan);
          inSearch = true;
          searchSpan = otelTracer.startSpan('search.main', traceId, rootSpan.spanId);
          searchSpan.setAttributes({ 'text.length': text.length, 'pattern.length': pattern.length });
        }
        if (step.found) {
          rootSpan.addEvent('match.found', { position: step.foundAt });
          otelLogger.info(`Match encontrado na posição ${step.foundAt}`, { algorithm: info.name, position: step.foundAt });
        }
      }
      if (preSpan.endTime === null) otelTracer.endSpan(preSpan);
      if (searchSpan) otelTracer.endSpan(searchSpan);
    } catch (e) {
      rootSpan.setStatus('ERROR', e.message);
      otelLogger.error(`Erro na busca: ${e.message}`, { algorithm: info.name });
      if (preSpan.endTime === null) otelTracer.endSpan(preSpan);
    }

    const timeMs = (performance.now() - start).toFixed(4);
    const lastStep = steps[steps.length - 1];
    const foundSteps = steps.filter(s => s.found);

    rootSpan.setAttributes({
      'result.time_ms': parseFloat(timeMs),
      'result.total_comparisons': lastStep?.totalComparisons ?? 0,
      'result.occurrences': foundSteps.length,
      'result.positions': JSON.stringify(foundSteps.map(s => s.foundAt)),
    });
    otelTracer.endSpan(rootSpan);

    // Métricas
    otelMetrics.increment('search.executions', 1, { algorithm: info.name });
    otelMetrics.increment('search.comparisons', lastStep?.totalComparisons ?? 0, { algorithm: info.name });
    otelMetrics.increment('search.occurrences', foundSteps.length);
    otelMetrics.record('search.duration_ms', parseFloat(timeMs), { algorithm: info.name });

    otelLogger.info(`Busca concluída: ${info.name}`, {
      timeMs, comparisons: lastStep?.totalComparisons ?? 0, occurrences: foundSteps.length,
    });

    DashboardController.update();

    return new SearchResult({
      algorithmName: info.name,
      timeMs,
      totalComparisons: lastStep?.totalComparisons ?? 0,
      occurrences: foundSteps.length,
      positions: foundSteps.map(s => s.foundAt),
      theoreticalComplexity: info.complexity,
      spaceComplexity: info.spaceComplexity,
      textLength: text.length,
      patternLength: pattern.length,
      traceId,
      spanId: rootSpan.spanId,
      steps,
    });
  }

  /** Retorna generator para execução passo a passo. */
  executeStepByStep(text, pattern) {
    return this._strategy.search(text, pattern);
  }
}

// ─────────────────────────────────────────────────────────────
//  StrategyFactory — cria estratégias
// ─────────────────────────────────────────────────────────────
const StrategyFactory = {
  naive:       () => new NaiveSearch(),
  rabin_karp:  () => new RabinKarpSearch(),
  kmp:         () => new KMPSearch(),
  boyer_moore: () => new BoyerMooreSearch(),
};
