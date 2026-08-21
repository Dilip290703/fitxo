const C = process.stdout.isTTY
  ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { dim: '', red: '', green: '', yellow: '', bold: '', off: '' };

export class Report {
  constructor() {
    this.results = [];
    this.section = '(none)';
    this.startedAt = Date.now();
  }

  heading(name) {
    this.section = name;
    process.stdout.write(`\n${C.bold}── ${name} ──${C.off}\n`);
  }

  /**
   * The only way a check enters the record. Takes the boolean AND the evidence:
   * a passing assertion that cannot say what it saw is indistinguishable from
   * one that never ran, and a suite full of those is how "all green" stops
   * meaning anything.
   */
  check(name, passed, evidence = '') {
    this.results.push({ section: this.section, name, passed, evidence });
    const mark = passed ? `${C.green}PASS${C.off}` : `${C.red}FAIL${C.off}`;
    process.stdout.write(`  ${mark} ${name}${evidence ? `${C.dim} — ${evidence}${C.off}` : ''}\n`);
    return passed;
  }

  skip(name, why) {
    this.results.push({ section: this.section, name, skipped: true, evidence: why });
    process.stdout.write(`  ${C.yellow}SKIP${C.off} ${name}${C.dim} — ${why}${C.off}\n`);
  }

  info(msg) {
    process.stdout.write(`  ${C.dim}${msg}${C.off}\n`);
  }

  /** An assertion that threw is a failure, never a crash that hides the rest. */
  async guard(name, fn) {
    try {
      return await fn();
    } catch (err) {
      this.check(name, false, `threw: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Assert that a call fails with a specific error code. Used constantly here,
   * because most of this money path's correctness lives in its REFUSALS —
   * DELIVERY_FEE_UNPAID, OUT_OF_STOCK, ORDER_LIMIT_ACTIVE. A test that only
   * checks happy paths would pass against a build with every guard deleted.
   */
  expectError(name, error, expectedCode) {
    if (!error) return this.check(name, false, `expected ${expectedCode}, but the call SUCCEEDED`);
    const msg = error.message ?? String(error);
    return this.check(name, msg.includes(expectedCode), `expected ${expectedCode}, got: ${msg.slice(0, 120)}`);
  }

  get failed() {
    return this.results.filter((r) => r.passed === false);
  }

  summary() {
    const passed = this.results.filter((r) => r.passed === true).length;
    const skipped = this.results.filter((r) => r.skipped).length;
    const failed = this.failed;
    const secs = ((Date.now() - this.startedAt) / 1000).toFixed(1);

    process.stdout.write(`\n${C.bold}${'='.repeat(64)}${C.off}\n`);
    if (failed.length) {
      process.stdout.write(`${C.red}${C.bold}${failed.length} FAILED${C.off}\n\n`);
      for (const f of failed) {
        process.stdout.write(`  ${C.red}✗${C.off} [${f.section}] ${f.name}\n    ${C.dim}${f.evidence}${C.off}\n`);
      }
      process.stdout.write('\n');
    }
    process.stdout.write(
      `${passed} passed · ${failed.length} failed · ${skipped} skipped · ${secs}s\n`,
    );
    return failed.length === 0;
  }
}
