"""Rebuild the code knowledge graph (AST only, no API key, no cost).

graphify skips any directory named `dist`, so the web app is indexed as its own root and merged with the
project graph (tools, tests). Output: graphify-out/graph.json and GRAPH_REPORT.md.

Usage: python tools/graph.py
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def graphify(*args):
    result = subprocess.run([sys.executable, '-X', 'utf8', '-m', 'graphify', *map(str, args)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        sys.exit(f'graphify {" ".join(map(str, args))} failed:\n{result.stdout}\n{result.stderr}')
    return result.stdout


def main():
    graphify('extract', '.', '--code-only')
    main_graph = ROOT / 'graphify-out' / 'graph.json'
    kept = ROOT / 'graphify-out' / 'project-graph.json'
    shutil.copy2(main_graph, kept)
    graphify('extract', 'dist', '--code-only', '--out', 'graphify-web')
    web_graph = ROOT / 'graphify-web' / 'graphify-out' / 'graph.json'
    graphify('merge-graphs', kept, web_graph, '--out', main_graph)
    graphify('cluster-only', '.', '--no-label')
    print(graphify('benchmark').strip().splitlines()[-6:])


if __name__ == '__main__':
    main()
