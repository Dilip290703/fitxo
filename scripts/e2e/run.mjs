#!/usr/bin/env node
/**
 * Fitxo end-to-end money-path suite.
 *
 *   node scripts/e2e/run.mjs --preflight   read-only; safe anywhere incl. prod
 *   node scripts/e2e/run.mjs               full run against dev (writes + cleans up)
 *   node scripts/e2e/run.mjs --keep        full run, leave fixtures for inspection
 *   node scripts/e2e/run.mjs --sweep       delete leftovers from a crashed run
 *
 * Exit 0 = every assertion passed. Exit 1 = at least one failed. Exit 2 =
 * the suite could not run (bad credentials, refused target).
 */
import { loadEnv, assertTargetIsSafe } from './lib/env.mjs';
import { Report } from './lib/report.mjs';
import { World, sweep } from './lib/world.mjs';
import { preflight } from './suites/preflight.mjs';
import { orderSuite } from './suites/order.mjs';
import { fulfilmentSuite } from './suites/fulfilment.mjs';
import { cancelSuite } from './suites/cancel.mjs';
import { residueSuite } from './suites/residue.mjs';

const args = new Set(process.argv.slice(2));
const PREFLIGHT_ONLY = args.has('--preflight');
const KEEP = args.has('--keep');
const SWEEP = args.has('--sweep');

const report = new Report();

async function main() {
  let env;
  try {
    env = loadEnv();
    assertTargetIsSafe(env, !PREFLIGHT_ONLY);
  } catch (err) {
    process.stderr.write(`\n${err.message}\n\n`);
    process.exit(2);
  }

  process.stdout.write(
    `\nFitxo E2E — ${PREFLIGHT_ONLY ? 'PREFLIGHT (read-only)' : SWEEP ? 'SWEEP' : 'FULL RUN (writes to the database)'}\n` +
    `target: ${env.ref}\n`,
  );

  if (SWEEP) {
    report.heading('sweep');
    const n = await sweep(env, report);
    report.check('sweep completed', true, `${n} leftover fixture group(s) removed`);
    return report.summary();
  }

  const ctx = await preflight(env, report);

  if (PREFLIGHT_ONLY) {
    process.stdout.write('\n(preflight only — no writes were made, no fixtures created)\n');
    return report.summary();
  }

  const world = new World(env, report);
  process.stdout.write(`run id: ${world.runId} — every fixture is prefixed ${world.tag}\n`);

  let teardownProblems = [];
  try {
    await orderSuite(world, report, ctx);
    await fulfilmentSuite(world, report, ctx);
    await cancelSuite(world, report, ctx);
  } catch (err) {
    // A stage that throws is a failed suite, not a lost teardown.
    report.check('suite completed without an unhandled error', false, `${err.message}\n${(err.stack ?? '').split('\n').slice(1, 4).join('\n')}`);
  } finally {
    if (KEEP) {
      report.heading('teardown');
      report.skip('teardown', `--keep: fixtures left behind under ${world.tag}. Remove them with --sweep.`);
    } else {
      report.heading('teardown');
      teardownProblems = await world.teardown();
      report.check(
        'all fixtures removed',
        teardownProblems.length === 0,
        teardownProblems.length ? teardownProblems.join(' | ') : `run ${world.tag} cleaned up`,
      );
    }
  }

  if (!KEEP) await residueSuite(world, report, ctx);

  return report.summary();
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    process.stderr.write(`\nFATAL: ${err.stack ?? err.message}\n`);
    process.exit(2);
  });
