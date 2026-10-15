"""Anthropic API client for agent inference. Falls back to mock when no API key."""

import os
import json
from pathlib import Path
import httpx

env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"
API_URL = "https://api.anthropic.com/v1/messages"

async def call_claude(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> dict:
    if not ANTHROPIC_API_KEY:
        from mock_claude_client import call_claude as mock_call
        return await mock_call(system_prompt, user_prompt, max_tokens)

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    text = data["content"][0]["text"]
    return parse_json_response(text)


def parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in response: {text[:200]}")

    raw = cleaned[start : end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Truncation repair: close open strings/arrays/objects
    repaired = raw
    in_string = False
    escape = False
    for ch in raw:
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
    if in_string:
        repaired += '"'

    open_brackets = 0
    open_braces = 0
    in_str = False
    esc = False
    for ch in repaired:
        if esc:
            esc = False
            continue
        if ch == '\\':
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '[':
            open_brackets += 1
        elif ch == ']':
            open_brackets -= 1
        elif ch == '{':
            open_braces += 1
        elif ch == '}':
            open_braces -= 1

    # Strip trailing comma before closing
    repaired = repaired.rstrip()
    if repaired.endswith(','):
        repaired = repaired[:-1]

    repaired += ']' * max(0, open_brackets) + '}' * max(0, open_braces)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        raise ValueError(f"Could not parse JSON (even after repair): {text[:300]}")
