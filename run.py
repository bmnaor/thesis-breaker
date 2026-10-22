#!/usr/bin/env python3
"""Judge-friendly entry point. The project is TypeScript; this wrapper runs the
same commands the README documents. Requires Node.js >= 20 and npm."""
import shutil
import subprocess
import sys

def main() -> int:
    if not shutil.which("npm"):
        print("Node.js/npm is required. See README.md.", file=sys.stderr)
        return 1
    cmd = sys.argv[1] if len(sys.argv) > 1 else "demo"
    if cmd in ("install", "setup"):
        return subprocess.call(["npm", "install"])
    if cmd == "test":
        return subprocess.call(["npm", "test"])
    if cmd == "conformance":
        return subprocess.call(["npm", "run", "conformance"])
    if cmd == "demo":
        return subprocess.call(["npm", "run", "demo"])
    return subprocess.call(["npx", "tsx", "src/cli.ts", *sys.argv[1:]])

if __name__ == "__main__":
    sys.exit(main())
