"""Anthropic API client for agent inference. Falls back to mock when no API key."""

import os
import json
import httpx


ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"
API_URL = "https://api.anthropic.com/v1/messages"

async def call_claude(system_prompt: str, user_prompt: str, max_tokens: int = 1000) -> dict:
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

    return json.loads(cleaned[start : end + 1])
