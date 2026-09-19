#!/usr/bin/env python
"""
CareerBridge Centralized Backend Test Runner
Executes all platform test suites or specified subsets, measuring elapsed time
and generating a clean execution summary.
"""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import time
from typing import List, Tuple

backend_dir = Path(__file__).resolve().parent


def discover_test_files() -> List[str]:
    """Find all test_*.py files in backend directory sorted alphabetically."""
    files = [
        f for f in os.listdir(backend_dir)
        if f.startswith("test_") and f.endswith(".py")
    ]
    return sorted(files)


def run_suite(python_bin: str, test_file: str) -> Tuple[bool, float, str]:
    """Run a single test script via subprocess, capturing status, time, and output."""
    start_time = time.time()
    res = subprocess.run(
        [python_bin, test_file],
        cwd=backend_dir,
        capture_output=True,
        text=True,
    )
    elapsed = time.time() - start_time
    output = res.stdout + "\n" + res.stderr
    return res.returncode == 0, elapsed, output


def main():
    parser = argparse.ArgumentParser(description="CareerBridge Backend Test Runner")
    parser.add_argument(
        "suites",
        nargs="*",
        help="Specific test file(s) to run. If omitted, runs all discovered test suites.",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print full stdout/stderr of each suite as it runs.",
    )
    args = parser.parse_args()

    python_bin = sys.executable

    all_discovered = discover_test_files()
    if args.suites:
        target_suites = []
        for s in args.suites:
            target = s if s.endswith(".py") else f"{s}.py"
            if not target.startswith("test_"):
                target = f"test_{target}"
            if target in all_discovered:
                target_suites.append(target)
            else:
                print(f"[WARN] Requested suite '{s}' not found in {backend_dir}. Skipping.")
        if not target_suites:
            print("[ERROR] No matching test suites found.")
            sys.exit(1)
    else:
        target_suites = all_discovered

    print("=" * 75)
    print(f"CAREERBRIDGE BACKEND TEST RUNNER — {len(target_suites)} SUITES SCHEDULED")
    print(f"Python: {python_bin}")
    print("=" * 75)

    passed_suites = []
    failed_suites = []
    total_start = time.time()

    for idx, suite in enumerate(target_suites, 1):
        print(f"[{idx:02d}/{len(target_suites):02d}] Running {suite}...", end="", flush=True)
        success, elapsed, output = run_suite(python_bin, suite)

        if success:
            print(f" [PASS] ({elapsed:.2f}s)")
            passed_suites.append((suite, elapsed))
        else:
            print(f" [FAIL] ({elapsed:.2f}s)")
            failed_suites.append((suite, elapsed, output))

        if args.verbose or not success:
            if not success:
                print("-" * 60)
                print(f"FAILURE OUTPUT FOR {suite}:")
                print(output[-1500:] if len(output) > 1500 else output)
                print("-" * 60)

    total_elapsed = time.time() - total_start

    print("\n" + "=" * 75)
    print("CAREERBRIDGE BACKEND TEST EXECUTION SUMMARY")
    print("=" * 75)
    print(f"Total Suites Executed : {len(target_suites)}")
    print(f"Suites Passed         : {len(passed_suites)}")
    print(f"Suites Failed         : {len(failed_suites)}")
    print(f"Total Elapsed Time    : {total_elapsed:.2f}s")
    print("=" * 75)

    if failed_suites:
        print("\nFAILED SUITES:")
        for f_name, f_time, _ in failed_suites:
            print(f"  - {f_name} ({f_time:.2f}s)")
        print("\nTest execution failed. See logs above for failure details.")
        sys.exit(1)
    else:
        print("\nALL TEST SUITES PASSED 100% SUCCESSFULLY!")
        sys.exit(0)


if __name__ == "__main__":
    main()
