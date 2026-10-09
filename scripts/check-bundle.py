#!/usr/bin/env python3
"""Checks a finished web build (default: dist/) for the startup crash that stopped the app from loading on 9 Oct 2026.

    npm run build && python3 scripts/check-bundle.py [dist-folder]

The build is split into several .js files that import each other. If two of them import each other in a loop, the browser
runs one before the other is ready and the app dies on start with an error such as "x is not a function", showing only
the "please enable JavaScript" message. This happened when code used by both the desktop and the mobile app was not covered by
the chunk rules in vite.config.ts and ended up in Vite's helper file. This script fails on any such loop, and on any ext code
sitting in a helper file, so the problem shows up in the build instead of in front of a customer.
"""
import glob
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "dist"
js = os.path.join(root, "js")

if not os.path.isdir(js):
    sys.exit("no build found in %s (run npm run build first)" % js)

graph = {}
sources = {}

for path in glob.glob(os.path.join(js, "*.js")):
    name = os.path.basename(path)
    text = open(path, encoding="utf-8", errors="replace").read()
    sources[name] = text
    deps = set(re.findall(r'^import\s[^;]*?from\s*["\']\./([^"\']+)["\']', text, re.M))
    deps |= set(re.findall(r'^import\s*["\']\./([^"\']+)["\']', text, re.M))
    graph[name] = sorted(d for d in deps if os.path.exists(os.path.join(js, d)))

short = lambda n: re.sub(r"-[A-Za-z0-9_-]{8}\.js$", "", n)

cycles = set()
visited, stack, on_stack = set(), [], set()


def visit(node):
    visited.add(node)
    stack.append(node)
    on_stack.add(node)

    for nxt in graph.get(node, []):
        if nxt in on_stack:
            loop = stack[stack.index(nxt):]
            start = loop.index(min(loop))  # the same loop is found from any starting point; keep one spelling
            cycles.add(tuple(loop[start:] + loop[:start]))
        elif nxt not in visited:
            visit(nxt)

    stack.pop()
    on_stack.discard(node)


for node in sorted(graph):
    if node not in visited:
        visit(node)

problems = []

for loop in sorted(cycles):
    problems.append("files import each other in a loop: " + " -> ".join(short(n) for n in loop) + " -> " + short(loop[0]))

# the helper files every other file depends on must hold no application code
for name, text in sources.items():
    if re.match(r"(preload-helper|modulepreload-polyfill)-", name):
        app_regions = [r for r in re.findall(r"^//#region (src/[^\n]+)", text, re.M)]

        if app_regions:
            problems.append("%s contains application code: %s" % (short(name), ", ".join(app_regions[:4])))

print("checked %d files in %s" % (len(graph), js))

if problems:
    for problem in problems:
        print("PROBLEM:", problem)
    print("Fix: make sure code used by both the desktop and the mobile app is in src/ext/shared/ (matched by the 'common' group in vite.config.ts).")
    sys.exit(1)

print("no loops between files, and no application code in the helper files")
