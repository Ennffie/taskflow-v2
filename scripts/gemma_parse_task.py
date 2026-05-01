#!/usr/bin/env python3
import json
import os
import re
import sys
from typing import Any

import requests

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("TASK_PARSE_MODEL", "gemma4:e4b")
TODAY = os.getenv("TASK_PARSE_TODAY", "2026-05-01")

PROMPT_TEMPLATE = """You are a task-extraction engine.
Extract a single best task draft from the pasted content.
Return JSON only. No markdown. No explanation.

Rules:
- Today date is {today}.
- Resolve relative dates like tomorrow / next Friday against that date.
- Keep language as found in source when possible.
- If assignee is unknown, use null.
- If deadline date is unknown, use null.
- If deadline time is unknown, use null.
- If reminder is unknown, use null.
- If content is not clearly a task, still make the best possible draft and lower confidence.
- deadline_date format: YYYY-MM-DD or null
- deadline_time format: HHMM or null
- confidence: one of high, medium, low
- next_action should be a short plain string.

JSON schema:
{{
  "title": string,
  "assignee": string | null,
  "deadline_date": string | null,
  "deadline_time": string | null,
  "reminder_hint": string | null,
  "next_action": string,
  "confidence": "high" | "medium" | "low"
}}

Pasted content:
---
{content}
---
"""


def call_ollama(prompt: str) -> str:
    response = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={"model": MODEL, "prompt": prompt, "stream": False},
        timeout=180,
    )
    response.raise_for_status()
    return response.json().get("response", "")


def extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError(f"No JSON object found in model output: {text[:300]}")
    return json.loads(match.group(0))


def main() -> None:
    if len(sys.argv) > 1:
        content = " ".join(sys.argv[1:]).strip()
    else:
        content = sys.stdin.read().strip()

    if not content:
        print("Usage: gemma_parse_task.py '<pasted content>'", file=sys.stderr)
        sys.exit(1)

    prompt = PROMPT_TEMPLATE.format(content=content, today=TODAY)
    raw = call_ollama(prompt)
    parsed = extract_json(raw)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
