#!/usr/bin/env python3
"""Chrome native messaging host: runs the logged-in Claude Code CLI to extract a calendar event."""

import json
import os
import pwd
import shutil
import struct
import subprocess
import sys
import tempfile

CLAUDE_TIMEOUT_SECONDS = 90

# Chrome launches native hosts with a minimal PATH that omits Homebrew and user installs.
EXTRA_PATHS = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/.claude/local"),
]


def read_message():
    header = sys.stdin.buffer.read(4)
    if len(header) < 4:
        return None
    (length,) = struct.unpack("<I", header)
    return json.loads(sys.stdin.buffer.read(length))


def write_message(message):
    body = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(body)))
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


def find_claude():
    search_path = os.pathsep.join([os.environ.get("PATH", ""), *EXTRA_PATHS])
    claude = shutil.which("claude", path=search_path)
    if not claude:
        raise RuntimeError("claude CLI not found; install Claude Code and log in")
    return claude


def claude_env():
    env = dict(os.environ)
    # Claude Code looks up its login in the macOS keychain by user name.
    env.setdefault("USER", pwd.getpwuid(os.getuid()).pw_name)
    return env


def extract(request):
    command = [
        find_claude(),
        "-p",
        "--model", request["model"],
        "--system-prompt", request["system"],
        "--json-schema", json.dumps(request["schema"]),
        "--output-format", "json",
        "--tools", "",
        "--strict-mcp-config",
        "--setting-sources", "",
        "--no-session-persistence",
    ]
    completed = subprocess.run(
        command,
        input=request["text"],
        capture_output=True,
        text=True,
        timeout=CLAUDE_TIMEOUT_SECONDS,
        cwd=tempfile.gettempdir(),
        env=claude_env(),
    )
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"claude exited {completed.returncode}: {detail[:500]}")

    if result.get("is_error") or "structured_output" not in result:
        raise RuntimeError(str(result.get("result") or result.get("subtype") or "no structured output")[:500])
    return result["structured_output"]


def main():
    request = read_message()
    if request is None:
        return
    try:
        write_message({"ok": True, "event": extract(request)})
    except subprocess.TimeoutExpired:
        write_message({"ok": False, "error": f"claude timed out after {CLAUDE_TIMEOUT_SECONDS}s"})
    except Exception as err:
        write_message({"ok": False, "error": str(err)})


if __name__ == "__main__":
    main()
