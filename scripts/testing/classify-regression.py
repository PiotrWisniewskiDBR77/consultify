#!/usr/bin/env python3
"""
Parse two vitest --reporter=dot batch output files (candidate vs baseline)
and classify failing tests: introduced | fixed | identical_pre_existing.
Also reports file-level-only failures (whole file failed to collect, no
per-test breakdown available in dot reporter -> treat file as one unit).

Usage: classify.py <candidate.txt> <baseline.txt> <batch-name>
Prints a markdown table fragment and a summary.
"""
import re
import sys

FAIL_RE = re.compile(r'^\s*FAIL\s+(\S+)(?:\s+\[.*\])?(?:\s+>\s+(.*))?$')

def parse_fails(path):
    fails = set()
    exit_code = None
    summary_line = None
    tests_line = None
    try:
        with open(path, 'r', errors='replace') as f:
            for line in f:
                line = line.rstrip('\n')
                m = FAIL_RE.match(line)
                if m:
                    file_path = m.group(1)
                    test_name = m.group(2) or '<file-level>'
                    fails.add((file_path, test_name))
                if line.startswith('EXIT_CODE='):
                    exit_code = line.split('=', 1)[1]
                if 'Test Files' in line and ('failed' in line or 'passed' in line):
                    summary_line = line.strip()
                if line.strip().startswith('Tests') and ('failed' in line or 'passed' in line):
                    tests_line = line.strip()
    except FileNotFoundError:
        return None
    return {'fails': fails, 'exit_code': exit_code, 'summary': summary_line, 'tests': tests_line}

def main():
    cand_path, base_path, batch_name = sys.argv[1], sys.argv[2], sys.argv[3]
    cand = parse_fails(cand_path)
    base = parse_fails(base_path)

    print(f"## Batch: {batch_name}")
    print()
    if cand is None:
        print(f"CANDIDATE result file not found: {cand_path}")
        return
    print(f"- Candidate: exit={cand['exit_code']} | {cand['summary']} | {cand['tests']}")
    if base is None:
        print(f"- Baseline: NOT RUN / file not found: {base_path}")
    else:
        print(f"- Baseline:  exit={base['exit_code']} | {base['summary']} | {base['tests']}")
    print()

    if base is None:
        print("No baseline data — cannot classify yet.")
        return

    cand_fails = cand['fails']
    base_fails = base['fails']

    introduced = sorted(cand_fails - base_fails)
    fixed = sorted(base_fails - cand_fails)
    identical = sorted(cand_fails & base_fails)

    print(f"- introduced (fail in candidate, pass in baseline): {len(introduced)}")
    print(f"- fixed (pass in candidate, fail in baseline): {len(fixed)}")
    print(f"- identical_pre_existing (fail in both): {len(identical)}")
    print()

    if introduced:
        print("### INTRODUCED (needs investigation/fix)")
        for f, t in introduced:
            print(f"- `{f}` :: {t}")
        print()
    if fixed:
        print("### FIXED (was failing in baseline, now passes)")
        for f, t in fixed:
            print(f"- `{f}` :: {t}")
        print()
    if identical:
        print("### identical_pre_existing (sample, up to 40)")
        for f, t in identical[:40]:
            print(f"- `{f}` :: {t}")
        if len(identical) > 40:
            print(f"- ... and {len(identical) - 40} more")
        print()

if __name__ == '__main__':
    main()
