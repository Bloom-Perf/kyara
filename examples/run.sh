#!/usr/bin/env bash
#
# Kyara + Hikaku — example workflow
#
# This script demonstrates the three main phases:
#   1. Run a scenario and establish a performance baseline
#   2. Run the same scenario again and compare against the baseline
#   3. (Optional) Generate an LLM-powered analysis report
#
# Prerequisites:
#   - Node.js v22+
#   - Firefox installed for Puppeteer:  npm run installFirefox
#   - Project built:                    npm run build
#
# Usage:
#   # From the repository root:
#   bash examples/run.sh [phase]
#
#   Phases:
#     baseline   — Run the scenario and save a baseline snapshot
#     compare    — Run the scenario and compare with the baseline
#     report     — Same as compare, with LLM report generation (requires ANTHROPIC_API_KEY)
#     all        — Run baseline, then compare (default)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SCENARIO="$SCRIPT_DIR/scenario.yaml"
BASELINE="$SCRIPT_DIR/baseline.json"
REPORT_FILE="$SCRIPT_DIR/hikaku-report.md"

PHASE="${1:-all}"

# ─── Common environment ──────────────────────────────────────────────

export KYARA_YAML_FILE_PATH="$SCENARIO"
export KYARA_HEADLESS=true
export KYARA_HTTP_PORT=0

# ─── Phase functions ─────────────────────────────────────────────────

run_baseline() {
  echo "══════════════════════════════════════════════════════════"
  echo "  Phase 1 — Establishing performance baseline"
  echo "══════════════════════════════════════════════════════════"
  echo ""
  echo "  Scenario :  $SCENARIO"
  echo "  Baseline :  $BASELINE"
  echo ""

  export KYARA_HIKAKU_BASELINE_PATH="$BASELINE"
  export KYARA_HIKAKU_UPDATE_BASELINE=true

  (cd "$ROOT_DIR" && node dist/main.js) || true

  if [ -f "$BASELINE" ]; then
    echo ""
    echo "✓ Baseline saved to $BASELINE"
    echo ""
  else
    echo ""
    echo "✗ Baseline file was not created — check the logs above."
    exit 1
  fi
}

run_compare() {
  echo "══════════════════════════════════════════════════════════"
  echo "  Phase 2 — Comparing against baseline"
  echo "══════════════════════════════════════════════════════════"
  echo ""
  echo "  Scenario :  $SCENARIO"
  echo "  Baseline :  $BASELINE"
  echo "  Threshold:  20 % max increase (default)"
  echo ""

  if [ ! -f "$BASELINE" ]; then
    echo "✗ No baseline found. Run 'baseline' phase first."
    exit 1
  fi

  export KYARA_HIKAKU_BASELINE_PATH="$BASELINE"
  unset KYARA_HIKAKU_UPDATE_BASELINE 2>/dev/null || true

  (cd "$ROOT_DIR" && node dist/main.js)

  echo ""
  echo "✓ Comparison complete — no regressions detected."
}

run_report() {
  echo "══════════════════════════════════════════════════════════"
  echo "  Phase 3 — Comparing with LLM analysis report"
  echo "══════════════════════════════════════════════════════════"
  echo ""
  echo "  Scenario :  $SCENARIO"
  echo "  Baseline :  $BASELINE"
  echo "  Report   :  $REPORT_FILE"
  echo ""

  if [ ! -f "$BASELINE" ]; then
    echo "✗ No baseline found. Run 'baseline' phase first."
    exit 1
  fi

  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "✗ ANTHROPIC_API_KEY is not set. Export it before running this phase:"
    echo ""
    echo "    export ANTHROPIC_API_KEY=sk-ant-..."
    echo "    bash examples/run.sh report"
    echo ""
    exit 1
  fi

  export KYARA_HIKAKU_BASELINE_PATH="$BASELINE"
  unset KYARA_HIKAKU_UPDATE_BASELINE 2>/dev/null || true
  export KYARA_HIKAKU_REPORT_MODE=always
  export KYARA_HIKAKU_REPORT_OUTPUT=file
  export KYARA_HIKAKU_REPORT_FILE_PATH="$REPORT_FILE"
  export KYARA_HIKAKU_REPORT_LOCALE=en

  (cd "$ROOT_DIR" && node dist/main.js)

  echo ""
  if [ -f "$REPORT_FILE" ]; then
    echo "✓ LLM report saved to $REPORT_FILE"
    echo ""
    echo "── Report ─────────────────────────────────────────────"
    cat "$REPORT_FILE"
    echo ""
    echo "──────────────────────────────────────────────────────"
  else
    echo "⚠ Report file was not created — check the logs above."
  fi
}

# ─── Main ────────────────────────────────────────────────────────────

case "$PHASE" in
  baseline)
    run_baseline
    ;;
  compare)
    run_compare
    ;;
  report)
    run_report
    ;;
  all)
    run_baseline
    echo ""
    run_compare
    ;;
  *)
    echo "Unknown phase: $PHASE"
    echo "Usage: bash examples/run.sh [baseline|compare|report|all]"
    exit 1
    ;;
esac
