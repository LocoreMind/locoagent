#!/bin/bash
# Run Claude Code from source with Bun
# Usage:
#   ./run-claude.sh                    # interactive mode
#   ./run-claude.sh -p "hello"         # print mode (single query)
#   ./run-claude.sh --help             # show help
cd "$(dirname "$0")"
exec bun run --preload ./stubs/globals.ts ./src/entrypoints/cli.tsx "$@"
