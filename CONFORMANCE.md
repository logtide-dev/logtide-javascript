# Conformance

Scenario-by-scenario status of this SDK against the LogTide SDK contract.
Each scenario ID is stable across all official SDKs; "n/a" entries explain
why a scenario does not apply. TODO entries are tracked work.

| ID | Scenario | Status | Test reference |
|---|---|---|---|
| C01 | basic log: one POST to /api/v1/ingest with X-API-Key, {logs:[...]} body, RFC 3339 time, metadata.sdk | ✅ | `tests/client.test.ts`, `tests/spec-tier1.test.ts` (sdk stamp) |
| C02 | batch by size: batchSize entries flush automatically, order preserved | ✅ | `tests/transport-batch.test.ts` |
| C03 | batch by interval: entries delivered without explicit flush | ✅ | `tests/transport-batch.test.ts` (interval) |
| C04 | wire format strictness: SDK fields nested in metadata, only contract fields top-level | ✅ | `tests/client.test.ts` (InternalLogEntry shape) |
| C05 | exception capture: structured metadata.exception with type/message/language/frames/cause | ✅ | `tests/error-serializer.test.ts` (exception, cause chain) |
| C06 | exception chain cap: cause depth ≤ 10, no infinite loop on cycles | ✅ | `tests/error-serializer.test.ts` |
| C07 | retry on 5xx with growing backoff | ✅ | `tests/spec-tier1.test.ts` (429/5xx retried) |
| C08 | no retry on permanent 4xx (400/401/403/413) | ✅ | `tests/spec-tier1.test.ts` (no retry on 400) |
| C09 | Retry-After overrides computed backoff | ✅ | `tests/spec-tier1.test.ts` (Retry-After honoured) |
| C10 | circuit breaker opens after threshold failures | ✅ | `tests/circuit-breaker.test.ts` |
| C11 | circuit breaker half-open probe and recovery | ✅ | `tests/circuit-breaker.test.ts` |
| C12 | buffer cap: drops beyond maxBufferSize, counted, never throws | ✅ | `tests/transport-batch.test.ts` (maxBufferSize drop) |
| C13 | flush on close; capture after close is a silent no-op | ✅ | `tests/client.test.ts` (close flush) |
| C14 | DSN parsing incl. base path; invalid DSN fails at init | ✅ | `tests/dsn.test.ts` (incl. base path) |
| C15 | inbound traceparent lands on entry trace_id | ✅ | framework middleware tests (express/fastify/sveltekit/...) |
| C16 | no PII by default; API key never logged | ✅ | header sanitization in middleware tests |
| C17 | serialisation robustness: circular/unserialisable values never throw | partial | JSON.stringify; circular metadata is dropped by serializer |
| C18 | timestamp fidelity: time reflects capture, not delivery | ✅ | time stamped at capture (`client.ts`) |
| C20 | scope isolation across concurrent requests | ✅ | `tests/hub.test.ts`, `tests/scope.test.ts` |
| C21 | breadcrumb ring buffer eviction, oldest first | ✅ | `tests/breadcrumb-buffer.test.ts` |
| C22 | beforeSend can mutate or drop entries | TODO | beforeSend hook not implemented |
| C23 | sampling: rate 0 sends nothing (logs) / no-op spans (traces) | ✅ | `tests/client.test.ts` (tracesSampleRate no-op spans) |
| C24 | OTLP span export with service.name resource | ✅ | `tests/integration-trace.test.ts` (OTLP spans) |
| C25 | outbound traceparent injection on instrumented HTTP clients | ✅ | traceparent injection (express/fastify middleware tests) |
| C26 | log/trace correlation: active span ids on entries | ✅ | `tests/child-span.test.ts` |
| C27 | middleware error capture rethrows after logging | ✅ | framework error-handler tests |
| C28 | logging-bridge level mapping and scope context | partial | console breadcrumbs; pino/winston transports TODO |
