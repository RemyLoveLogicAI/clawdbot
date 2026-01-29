/**
 * @fileoverview Convergence Core Benchmarks
 * @module convergence-core/benchmarks
 *
 * Performance benchmarks for all convergence components.
 * Run with: npx tsx extensions/convergence-core/benchmarks/benchmark.ts
 */

import { AutoConfigManager } from "../src/auto-config.js";
import { ObservabilityManager } from "../src/observability.js";
import { NotificationManager } from "../src/notifications.js";
import { AutonomousController } from "../src/autonomous-controller.js";

// ============================================================================
// Benchmark Utilities
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  opsPerSecond: number;
  memoryUsedMB: number;
}

async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations = 10000
): Promise<BenchmarkResult> {
  const times: number[] = [];
  const memBefore = process.memoryUsage().heapUsed;

  // Warmup
  for (let i = 0; i < 100; i++) {
    await fn();
  }

  // Benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const memAfter = process.memoryUsage().heapUsed;
  const totalTimeMs = times.reduce((a, b) => a + b, 0);

  return {
    name,
    iterations,
    totalTimeMs,
    avgTimeMs: totalTimeMs / iterations,
    minTimeMs: Math.min(...times),
    maxTimeMs: Math.max(...times),
    opsPerSecond: (iterations / totalTimeMs) * 1000,
    memoryUsedMB: (memAfter - memBefore) / 1024 / 1024,
  };
}

function formatResult(result: BenchmarkResult): string {
  return `
┌─────────────────────────────────────────────────────────────────┐
│ ${result.name.padEnd(63)} │
├─────────────────────────────────────────────────────────────────┤
│ Iterations:     ${result.iterations.toString().padStart(45)} │
│ Total Time:     ${result.totalTimeMs.toFixed(2).padStart(42)} ms │
│ Avg Time:       ${result.avgTimeMs.toFixed(4).padStart(42)} ms │
│ Min Time:       ${result.minTimeMs.toFixed(4).padStart(42)} ms │
│ Max Time:       ${result.maxTimeMs.toFixed(4).padStart(42)} ms │
│ Ops/Second:     ${result.opsPerSecond.toFixed(0).padStart(45)} │
│ Memory Delta:   ${result.memoryUsedMB.toFixed(2).padStart(42)} MB │
└─────────────────────────────────────────────────────────────────┘`;
}

// ============================================================================
// Observability Benchmarks
// ============================================================================

async function benchmarkObservability(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const obs = new ObservabilityManager({ debugMode: false });

  // Benchmark: Counter increment
  results.push(
    await benchmark("Observability: Counter Increment", () => {
      obs.incrementCounter("test_counter", 1, { label: "test" });
    })
  );

  // Benchmark: Gauge set
  results.push(
    await benchmark("Observability: Gauge Set", () => {
      obs.setGauge("test_gauge", Math.random() * 100, { label: "test" });
    })
  );

  // Benchmark: Histogram record
  results.push(
    await benchmark("Observability: Histogram Record", () => {
      obs.recordHistogram("test_histogram", Math.random() * 1000, { label: "test" });
    })
  );

  // Benchmark: Logging (info)
  results.push(
    await benchmark(
      "Observability: Info Log",
      () => {
        obs.info("Benchmark", "Test log message", { key: "value" });
      },
      1000 // Fewer iterations for I/O
    )
  );

  // Benchmark: Span creation
  results.push(
    await benchmark("Observability: Span Start/End", () => {
      const span = obs.startSpan("test_span", { attr: "value" });
      obs.endSpan(span.spanId, "ok");
    })
  );

  // Benchmark: Dashboard data generation
  results.push(
    await benchmark(
      "Observability: Dashboard Data",
      () => {
        obs.getDashboardData();
      },
      1000
    )
  );

  // Benchmark: Prometheus export
  results.push(
    await benchmark(
      "Observability: Prometheus Export",
      () => {
        obs.exportPrometheusMetrics();
      },
      1000
    )
  );

  return results;
}

// ============================================================================
// Notification Benchmarks
// ============================================================================

async function benchmarkNotifications(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const notif = new NotificationManager({
    defaultChannels: ["console"],
    rateLimitEnabled: false,
  });

  // Benchmark: Event trigger (no delivery)
  results.push(
    await benchmark(
      "Notifications: Event Trigger (console)",
      async () => {
        await notif.triggerEvent("test.event", { data: "test" });
      },
      100 // Console I/O
    )
  );

  // Benchmark: Rule matching
  results.push(
    await benchmark("Notifications: Rule Matching", () => {
      notif.getRules().filter((r) => r.eventPatterns.some((p) => p.includes("test")));
    })
  );

  // Benchmark: Get history
  results.push(
    await benchmark("Notifications: Get History", () => {
      notif.getHistory(100);
    })
  );

  return results;
}

// ============================================================================
// Autonomous Controller Benchmarks
// ============================================================================

async function benchmarkController(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const controller = new AutonomousController({
    mode: "autonomous",
    verboseLogging: false,
  });

  await controller.start();

  // Benchmark: Task submission
  results.push(
    await benchmark(
      "Controller: Task Submit",
      async () => {
        await controller.submitTask("text", { message: "test" }, { priority: "normal" });
      },
      1000
    )
  );

  // Benchmark: Get status
  results.push(
    await benchmark("Controller: Get Status", () => {
      controller.getStatus();
    })
  );

  // Benchmark: Get capabilities
  results.push(
    await benchmark("Controller: Get Capabilities", () => {
      controller.getCapabilities();
    })
  );

  // Benchmark: Get decisions
  results.push(
    await benchmark("Controller: Get Decisions", () => {
      controller.getDecisions(100);
    })
  );

  await controller.stop();

  return results;
}

// ============================================================================
// Auto-Config Benchmarks
// ============================================================================

async function benchmarkAutoConfig(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const config = new AutoConfigManager({
    autoDiscover: false,
    autoConnect: false,
    autoHeal: false,
  });

  // Register test services
  for (let i = 0; i < 10; i++) {
    config.registerService({
      id: `test-service-${i}`,
      name: `Test Service ${i}`,
      type: "personaplex",
      url: `http://localhost:${8000 + i}`,
    });
  }

  // Benchmark: Get services
  results.push(
    await benchmark("AutoConfig: Get Services", () => {
      config.getServices();
    })
  );

  // Benchmark: Get services by type
  results.push(
    await benchmark("AutoConfig: Get By Type", () => {
      config.getServicesByType("personaplex");
    })
  );

  // Benchmark: Get healthy services
  results.push(
    await benchmark("AutoConfig: Get Healthy", () => {
      config.getHealthyServices();
    })
  );

  // Benchmark: Get status
  results.push(
    await benchmark("AutoConfig: Get Status", () => {
      config.getStatus();
    })
  );

  return results;
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

async function runAllBenchmarks(): Promise<void> {
  console.log(`
╔═════════════════════════════════════════════════════════════════╗
║           CONVERGENCE CORE PERFORMANCE BENCHMARKS               ║
║                                                                 ║
║  Node.js: ${process.version.padEnd(52)} ║
║  Platform: ${process.platform.padEnd(51)} ║
║  CPUs: ${require("os").cpus().length.toString().padEnd(55)} ║
║  Memory: ${(require("os").totalmem() / 1024 / 1024 / 1024).toFixed(1).padEnd(50)} GB ║
╚═════════════════════════════════════════════════════════════════╝
`);

  const allResults: BenchmarkResult[] = [];

  console.log("\n📊 Running Observability Benchmarks...\n");
  allResults.push(...(await benchmarkObservability()));

  console.log("\n🔔 Running Notification Benchmarks...\n");
  allResults.push(...(await benchmarkNotifications()));

  console.log("\n🤖 Running Controller Benchmarks...\n");
  allResults.push(...(await benchmarkController()));

  console.log("\n🔌 Running AutoConfig Benchmarks...\n");
  allResults.push(...(await benchmarkAutoConfig()));

  // Print all results
  console.log("\n\n═══════════════════════════════════════════════════════════════════");
  console.log("                         BENCHMARK RESULTS                          ");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  for (const result of allResults) {
    console.log(formatResult(result));
  }

  // Summary table
  console.log("\n\n═══════════════════════════════════════════════════════════════════");
  console.log("                           SUMMARY TABLE                            ");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  console.log("| Benchmark | Avg (ms) | Ops/sec | Memory |");
  console.log("|-----------|----------|---------|--------|");
  for (const r of allResults) {
    console.log(
      `| ${r.name.slice(0, 35).padEnd(35)} | ${r.avgTimeMs.toFixed(4).padStart(8)} | ${r.opsPerSecond.toFixed(0).padStart(7)} | ${r.memoryUsedMB.toFixed(2).padStart(5)}MB |`
    );
  }

  // Performance grades
  console.log("\n\n═══════════════════════════════════════════════════════════════════");
  console.log("                        PERFORMANCE GRADES                          ");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  for (const r of allResults) {
    let grade = "🟢 Excellent";
    if (r.avgTimeMs > 1) grade = "🟡 Good";
    if (r.avgTimeMs > 10) grade = "🟠 Acceptable";
    if (r.avgTimeMs > 100) grade = "🔴 Needs Optimization";

    console.log(`${grade.padEnd(20)} ${r.name}`);
  }

  // Export as JSON
  const report = {
    timestamp: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      cpus: require("os").cpus().length,
      memoryGB: require("os").totalmem() / 1024 / 1024 / 1024,
    },
    results: allResults,
    summary: {
      totalBenchmarks: allResults.length,
      avgOpsPerSecond:
        allResults.reduce((a, b) => a + b.opsPerSecond, 0) / allResults.length,
      totalMemoryMB: allResults.reduce((a, b) => a + b.memoryUsedMB, 0),
    },
  };

  console.log("\n\n═══════════════════════════════════════════════════════════════════");
  console.log("                          JSON REPORT                               ");
  console.log("═══════════════════════════════════════════════════════════════════\n");
  console.log(JSON.stringify(report, null, 2));
}

// Run if executed directly
runAllBenchmarks().catch(console.error);
