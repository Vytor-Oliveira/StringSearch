# StringSearch · N2 Evoluir

**Comparação de Algoritmos de Busca em Strings**  
Unidade 2 · Padrão Strategy · OpenTelemetry · Observabilidade

---

## 🎯 Objetivo

Evolução da aplicação de busca em strings, incorporando:
- **Padrão Strategy** (GoF) — algoritmos intercambiáveis
- **SearchResult** — estrutura de retorno padronizada
- **OpenTelemetry** — traces, métricas e logs estruturados
- **Dashboard de Monitoramento** — visualização em tempo real

---

## 📁 Estrutura do Projeto

```
StringSearch/
├── backend/                        # Arquivos de texto para testes
│   ├── texto1_curto.txt
│   ├── texto2_padroes_repetitivos.txt
│   ├── texto3_documento.txt
│   └── texto4_dna.txt
├── css/
│   └── styles.css                  # Estilos da aplicação
├── js/
│   ├── algorithms.js               # Strategy + SearchResult + Context + Factory
│   └── app.js                      # AppController + DashboardController
├── observability/
│   ├── otel.js                     # OtelTracer, Metrics, Logger, Exporter
│   ├── otel-collector.yml          # Configuração do OTEL Collector
│   └── prometheus.yml              # Configuração do Prometheus
├── .gitignore
├── docker-compose.yml              # Jaeger + Prometheus + OTEL Collector
├── index.html                      # Aplicação principal
├── README.md
└── RELATORIO_IA.md
```

---

## 🏗 Arquitetura

### Padrão Strategy (GoF)

```
SearchStrategy (Interface)
├── NaiveSearch          → O(n × m)
├── RabinKarpSearch      → O(n + m) médio
├── KMPSearch            → O(n + m)
└── BoyerMooreSearch     → O(n/m) melhor caso
SearchContext            → Usa a estratégia
StrategyFactory          → Cria estratégias
```

### SearchResult (Retorno estruturado)

Cada execução retorna um objeto `SearchResult` com:
- `algorithmName` — Nome do algoritmo
- `timeMs` — Tempo de execução em ms
- `totalComparisons` — Número de comparações realizadas
- `occurrences` — Número de ocorrências encontradas
- `positions` — Array com posições encontradas
- `theoreticalComplexity` — Complexidade Big-O
- `spaceComplexity` — Complexidade de espaço
- `traceId` — ID do trace OpenTelemetry
- `spanId` — ID do span OpenTelemetry
- `steps` — Array de passos da execução

### OpenTelemetry (Observabilidade)

```
OtelTracer   → Cria e gerencia spans
OtelMetrics  → Contadores e histogramas
OtelLogger   → Logs estruturados por severidade
OtelExporter → Exportação em formato OTLP/JSON
```

#### Instrumentação por execução:

1. **Span raiz** — cobre toda a execução do algoritmo
2. **Sub-span de pré-processamento** — construção de LPS/Bad Char
3. **Sub-span de busca** — fase principal de comparações
4. **Eventos** — cada match encontrado gera um evento no span
5. **Status** — OK ou ERROR com mensagem

#### Métricas coletadas:

| Métrica | Tipo | Labels |
|---------|------|--------|
| `search.executions` | Counter | algorithm |
| `search.comparisons` | Counter | algorithm |
| `search.occurrences` | Counter | — |
| `search.duration_ms` | Histogram | algorithm |

---

## 🚀 Como executar

### Pré-requisitos
- [Docker](https://www.docker.com/products/docker-desktop) instalado

### 1. Subir a stack de observabilidade

```bash
docker compose up -d
```

### 2. Abrir a aplicação

```bash
npx serve .
```

Acesse `http://localhost:3000` no navegador.

### 3. Acessar os serviços

| Serviço | URL |
|---------|-----|
| Aplicação | http://localhost:3000 |
| Jaeger (traces) | http://localhost:16686 |
| Prometheus (métricas) | http://localhost:9090 |

> **Sem Docker:** abra o `index.html` diretamente no navegador. O dashboard interno de observabilidade funciona normalmente.

---

## 📊 Dashboard

### Aba "Busca & Visualização"
- Execução individual por algoritmo (ou passo a passo)
- Highlight de ocorrências no texto
- Métricas do SearchResult com Trace ID
- Comparativo de todos os algoritmos

### Aba "Dashboard · Observabilidade"
- Contadores globais (execuções, comparações, matches, spans)
- Gráficos de barras: tempo e comparações por algoritmo
- Histórico de execuções (trace timeline)
- Logs estruturados em tempo real

### Aba "Traces & Spans"
- Lista de spans com nome, duração e status
- Atributos do último trace
- Exportação OTLP/JSON

---

## 🔬 Análise: Teórico vs Prático

| Algoritmo | Teórico | Prático |
|-----------|---------|---------|
| Naive | O(n×m) | Ruim em padrões com muitas repetições |
| Rabin-Karp | O(n+m) médio | Bom no geral; pior caso com muitas colisões |
| KMP | O(n+m) | Excelente em padrões com prefixo/sufixo repetido |
| Boyer-Moore | O(n/m) melhor | Excelente em textos longos com alfabeto variado |

---

## ✅ Boas Práticas Implementadas

- [x] Padrão Strategy — algoritmos intercambiáveis
- [x] SearchResult — retorno padronizado e tipado
- [x] StrategyFactory — criação centralizada
- [x] Generators — eficiência em passo a passo
- [x] Separação de responsabilidades (UI / Lógica / Observabilidade)
- [x] OtelTracer — rastreamento com spans hierárquicos
- [x] OtelMetrics — contadores e histogramas
- [x] OtelLogger — logs estruturados com severidade
- [x] OtelExporter — exportação OTLP/JSON compatível
- [x] Dashboard — visualização de monitoramento
- [x] Docker — stack completa com Jaeger + Prometheus