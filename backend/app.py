"""
StockShiftAI Backend — RAG-powered inventory optimization.

Endpoints:
  GET  /api/health              — Health check
  GET  /api/insights            — Top AI recommendations across all SKUs
  GET  /api/forecast/<sku>      — Demand forecast for a specific SKU
  GET  /api/anomalies           — All detected anomalies
  POST /api/chat                — Natural language inventory Q&A

Powered by: Firebase Firestore + OpenRouter LLM
"""

import json
import math
import os
import time
from datetime import datetime
from threading import Lock

from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

from supabase import create_client, Client

load_dotenv()

# ── App setup ────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

# ── Supabase Client Init ──────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://ebmnsrhwglctgwzfrljw.supabase.co")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as _err:
        print(f"⚠️  Supabase client init failed: {_err}")

# ── OpenRouter setup with Load Balancing & Failover ──────────────────────────

raw_keys = os.getenv("OPENROUTER_API_KEYS", "")
if not raw_keys:
    k1 = os.getenv("OPENROUTER_API_KEY", "").strip()
    k2 = os.getenv("OPENROUTER_BACKUP_API_KEY", "").strip()
    raw_keys = f"{k1},{k2}"

API_KEYS = [k.strip() for k in raw_keys.split(",") if k.strip()]

MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-01")

# ── In-memory response cache (TTL = 5 minutes) ───────────────────────────────

_cache: dict = {}
_cache_lock = Lock()
CACHE_TTL = 300  # 5 minutes in seconds


def cache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < CACHE_TTL:
            return entry["data"]
    return None


def cache_set(key: str, data):
    with _cache_lock:
        _cache[key] = {"data": data, "ts": time.time()}


def cache_bust(key: str):
    with _cache_lock:
        _cache.pop(key, None)


def _extract_json(raw: str) -> dict | None:
    """Try to parse JSON from LLM output that may contain markdown or extra text."""
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    # Remove markdown code fences
    if cleaned.startswith("```"):
        parts = cleaned.split("\n", 1)
        if len(parts) > 1:
            cleaned = parts[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Try to extract first complete {...} object
    start = cleaned.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(cleaned)):
        if cleaned[i] == "{":
            depth += 1
        elif cleaned[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def get_all_sku_stats() -> list[dict]:
    """Fetch metadata + stats for every SKU from Supabase Postgres DB."""
    if supabase:
        try:
            res = supabase.table("inventory_items").select("*").execute()
            if res.data and len(res.data) > 0:
                results = []
                for item in res.data:
                    results.append({
                        "sku": item.get("sku", ""),
                        "item_name": item.get("name", ""),
                        "category": item.get("category", ""),
                        "current_stock": int(item.get("quantity") or 0),
                        "unit_cost": float(item.get("unit_cost") or 0),
                        "sell_price": float(item.get("sell_price") or 0),
                        "reorder_point": int(item.get("reorder_point") or 0),
                        "location": item.get("location") or "Main Warehouse",
                        "avg_daily_demand_30d": max(1, int((item.get("reorder_point") or 10) / 15)),
                    })
                return results
        except Exception as _err:
            print(f"⚠️ Supabase fetch error: {_err}")

    return _get_fallback_stats()


def get_sku_data(sku: str) -> dict | None:
    """Fetch full data for a single SKU."""
    return _get_fallback_sku(sku)


# ── Fallback: use local JSON if Firestore is unavailable ────────────────────

_local_cache = None


def _load_local_data():
    global _local_cache
    if _local_cache is None:
        path = os.path.join(os.path.dirname(__file__), "data", "inventory_history.json")
        if os.path.exists(path):
            with open(path) as f:
                _local_cache = json.load(f)
        else:
            _local_cache = {}
    return _local_cache


def _get_fallback_stats() -> list[dict]:
    data = _load_local_data()
    results = []
    for sku, sku_data in data.items():
        results.append({
            "sku": sku,
            **sku_data.get("metadata", {}),
            **sku_data.get("stats", {}),
        })
    return results


def _get_fallback_sku(sku: str) -> dict | None:
    data = _load_local_data()
    if sku not in data:
        return None
    sku_data = data[sku]
    daily = sku_data.get("daily_data", [])
    return {
        "sku": sku,
        **sku_data.get("metadata", {}),
        **sku_data.get("stats", {}),
        "recent_daily": daily[-90:],
    }


# ── Helper: call LLM via OpenRouter ─────────────────────────────────────────


def call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 2500) -> str:
    """Send a prompt to OpenRouter with automatic API key failover & load balancing."""
    if not API_KEYS:
        print("⚠️ No OpenRouter API key configured.")
        return ""

    for idx, key in enumerate(API_KEYS):
        try:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=key,
            )
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=max_tokens,
                timeout=25,
            )
            content = response.choices[0].message.content or ""
            if content:
                return content
        except Exception as e:
            print(f"⚠️ OpenRouter Key #{idx+1} failed ({e}). Trying fallback key...")
            continue

    return ""


# ── Helper: build context prompt from stats ──────────────────────────────────

SYSTEM_PROMPT = """You are StockShiftAI, an expert inventory optimization assistant.
You analyze inventory data and provide actionable recommendations.

IMPORTANT RULES:
- Always respond in valid JSON format
- Be specific with numbers, dates, and quantities
- Consider lead times when making reorder recommendations
- Flag anomalies when demand deviates significantly from baseline
- Use seasonal patterns to improve forecast accuracy
- Calculate safety stock as: 1.65 × std_deviation × sqrt(lead_time_days)
- Urgency levels: "critical" (stockout in <3 days), "high" (<7 days), "medium" (<14 days), "low" (>14 days)
"""


def build_sku_context(sku_data: dict) -> str:
    """Build a text context string for a single SKU."""
    seasonal = sku_data.get("seasonal_factors", {})
    seasonal_str = ", ".join(
        f"Month {m}: {v:.2f}" for m, v in sorted(seasonal.items(), key=lambda x: int(x[0]))
    )

    return f"""
SKU: {sku_data.get('sku')}
Name: {sku_data.get('name')}
Category: {sku_data.get('category')}
Location: {sku_data.get('location')}
Unit Cost: ₹{sku_data.get('unit_cost', 0):.2f}
Sell Price: ₹{sku_data.get('sell_price', 0):.2f}
Lead Time: {sku_data.get('lead_time_days', 7)} days

Current Stock: {sku_data.get('current_stock', 0)} units
Days Until Stockout: {sku_data.get('days_until_stockout', 999)}

Avg Daily Demand (7d): {sku_data.get('avg_daily_demand_7d', 0):.1f}
Avg Daily Demand (30d): {sku_data.get('avg_daily_demand_30d', 0):.1f}
Avg Daily Demand (90d): {sku_data.get('avg_daily_demand_90d', 0):.1f}
Std Deviation (30d): {sku_data.get('std_deviation_30d', 0):.1f}
Trend Slope (90d): {sku_data.get('trend_slope_90d', 0):.4f} (positive = growing demand)
Year-over-Year Change: {sku_data.get('yoy_change_pct', 0):.1f}%

Seasonal Factors: {seasonal_str}
Recent Anomalies (30d): {sku_data.get('recent_anomaly_count', 0)}

Today's Date: {datetime.now().strftime('%Y-%m-%d')}
Current Month: {datetime.now().month}
""".strip()


def build_all_skus_context(all_stats: list[dict]) -> str:
    """Build a summary context for all SKUs."""
    lines = []
    for s in all_stats:
        urgency = "critical" if s.get("days_until_stockout", 999) < 3 else \
                  "high" if s.get("days_until_stockout", 999) < 7 else \
                  "medium" if s.get("days_until_stockout", 999) < 14 else "low"
        lines.append(
            f"- {s['sku']} ({s.get('name', '')}): "
            f"stock={s.get('current_stock', 0)}, "
            f"avg_demand_7d={s.get('avg_daily_demand_7d', 0):.1f}, "
            f"days_to_stockout={s.get('days_until_stockout', 999)}, "
            f"urgency={urgency}, "
            f"trend={s.get('trend_slope_90d', 0):.4f}, "
            f"yoy={s.get('yoy_change_pct', 0):.1f}%, "
            f"anomalies_30d={s.get('recent_anomaly_count', 0)}"
        )
    return "\n".join(lines)


# ── ROUTES ───────────────────────────────────────────────────────────────────


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "supabase": True, "llm": "OpenRouter"})


@app.route("/api/insights", methods=["GET"])
def insights():
    """Get top AI recommendations across all SKUs."""
    if request.args.get("refresh") != "1":
        cached = cache_get("insights")
        if cached:
            return jsonify(cached)

    all_stats = get_all_sku_stats()
    if not all_stats:
        return jsonify({"error": "No inventory data available"}), 404

    context = build_all_skus_context(all_stats)

    prompt = f"""Analyze this inventory data and return a JSON object with exactly this structure:

{{
  "recommendations": [
    {{
      "sku": "string",
      "item_name": "string",
      "type": "reorder | anomaly | overstock",
      "urgency": "critical | high | medium | low",
      "title": "short action title (max 10 words)",
      "description": "1-2 sentence explanation with specific numbers",
      "suggested_action": "specific action to take",
      "quantity": number_or_null,
      "confidence": 0.0_to_1.0
    }}
  ],
  "summary": "1 sentence overall inventory health summary"
}}

Return the top 5 most important recommendations sorted by urgency.
Only return valid JSON, no markdown.

INVENTORY DATA:
{context}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)

    try:
        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
        parsed = json.loads(cleaned)
        cache_set("insights", parsed)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({
            "recommendations": [],
            "summary": "Unable to parse AI response",
            "raw": raw,
        })


@app.route("/api/forecast/<sku>", methods=["GET", "POST"])
def forecast(sku: str):
    """Get demand forecast for a specific SKU."""
    cache_key = f"forecast_{sku}"
    if request.args.get("refresh") != "1":
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)

    sku_data = get_sku_data(sku)

    # If SKU not found in historical data, check for item details in POST body
    if not sku_data:
        body = request.get_json(silent=True) or {}
        item_info = body.get("item")
        if not item_info:
            return jsonify({"error": f"SKU {sku} not found"}), 404

        # Build a synthetic sku_data from the frontend item info
        sku_data = {
            "sku": sku,
            "name": item_info.get("name", "Unknown Item"),
            "category": item_info.get("category", "General"),
            "location": item_info.get("location", "Unknown"),
            "unit_cost": item_info.get("unitCost", 0),
            "sell_price": item_info.get("sellPrice", 0),
            "lead_time_days": 7,
            "current_stock": item_info.get("quantity", 0),
            "days_until_stockout": 999 if item_info.get("quantity", 0) > 0 else 0,
            "avg_daily_demand_7d": 0,
            "avg_daily_demand_30d": 0,
            "avg_daily_demand_90d": 0,
            "std_deviation_30d": 0,
            "trend_slope_90d": 0,
            "yoy_change_pct": 0,
            "seasonal_factors": {},
            "recent_anomaly_count": 0,
            "recent_daily": [],
        }

    context = build_sku_context(sku_data)

    # Also include last 30 days of actual data for the chart
    recent = sku_data.get("recent_daily", [])[-30:]

    prompt = f"""Based on this inventory data, forecast demand for the next 14 days.

Return a JSON object with exactly this structure:

{{
  "sku": "{sku}",
  "item_name": "string",
  "forecast": [
    {{"date": "YYYY-MM-DD", "predicted_demand": number, "lower_bound": number, "upper_bound": number}}
  ],
  "reorder": {{
    "recommended": true_or_false,
    "quantity": number,
    "urgency": "critical | high | medium | low",
    "order_by_date": "YYYY-MM-DD or null",
    "reason": "1-2 sentence explanation"
  }},
  "anomaly": {{
    "detected": true_or_false,
    "type": "demand_spike | demand_drop | trend_change | none",
    "severity": "high | medium | low | none",
    "detail": "explanation or empty string"
  }},
  "trend_summary": "1 sentence about the demand trend",
  "safety_stock": number
}}

Only return valid JSON, no markdown.

SKU DATA:
{context}

LAST 30 DAYS ACTUAL DATA:
{json.dumps(recent[-30:], indent=2)}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
        parsed = json.loads(cleaned)

        # Attach actual recent data for charting
        parsed["actual_data"] = recent
        cache_set(f"forecast_{sku}", parsed)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({
            "sku": sku,
            "forecast": [],
            "error": "Unable to parse AI response",
            "raw": raw,
        })


@app.route("/api/anomalies", methods=["GET"])
def anomalies():
    """Get all detected anomalies across SKUs."""
    if request.args.get("refresh") != "1":
        cached = cache_get("anomalies")
        if cached:
            return jsonify(cached)

    all_stats = get_all_sku_stats()
    if not all_stats:
        return jsonify({"error": "No inventory data available"}), 404

    context = build_all_skus_context(all_stats)

    prompt = f"""Analyze this inventory data for anomalies and unusual patterns.

Return a JSON object with exactly this structure:

{{
  "anomalies": [
    {{
      "sku": "string",
      "item_name": "string",
      "type": "demand_spike | demand_drop | trend_reversal | seasonal_deviation",
      "severity": "high | medium | low",
      "description": "specific explanation with numbers",
      "detected_date": "approximate YYYY-MM-DD",
      "recommendation": "what to do about it"
    }}
  ],
  "total_anomalies": number,
  "health_score": 0_to_100
}}

Only flag genuine anomalies — items where recent behavior significantly deviates from expected patterns.
Only return valid JSON, no markdown.

INVENTORY DATA:
{context}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
        parsed = json.loads(cleaned)
        cache_set("anomalies", parsed)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({
            "anomalies": [],
            "total_anomalies": 0,
            "health_score": 50,
            "raw": raw,
        })


@app.route("/api/chat", methods=["POST"])
def chat():
    """Natural language Q&A about inventory."""
    body = request.get_json()
    question = body.get("question", "")
    if not question:
        return jsonify({"error": "No question provided"}), 400

    all_stats = get_all_sku_stats()
    context = build_all_skus_context(all_stats)

    prompt = f"""A user is asking about their inventory. Answer their question based on the data below.
Be specific, use actual numbers from the data, and provide actionable advice.

Respond in JSON format:
{{
  "answer": "your detailed answer here",
  "relevant_skus": ["list", "of", "mentioned", "skus"],
  "suggested_actions": ["action 1", "action 2"]
}}

Only return valid JSON, no markdown.

INVENTORY DATA:
{context}

USER QUESTION: {question}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
        parsed = json.loads(cleaned)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({
            "answer": raw or "Unable to process your question.",
            "relevant_skus": [],
            "suggested_actions": [],
        })


@app.route("/api/cost-optimization", methods=["GET"])
def cost_optimization():
    """Calculate financial impact of current inventory state and AI recommendations."""
    if request.args.get("refresh") != "1":
        cached = cache_get("cost_optimization")
        if cached:
            return jsonify(cached)

    all_stats = get_all_sku_stats()
    
    context = build_all_skus_context(all_stats)
    
    prompt = f"""Analyze the inventory data and calculate the financial impact.

Calculate and return in JSON format ONLY (no markdown):
{{
  "total_capital_locked": <total value of current stock at unit_cost>,
  "overstock_capital": <value locked in overstock items (where current_stock > 90 days of avg_daily_demand_30d)>,
  "stockout_risk_cost": <estimated lost sales from items with days_until_stockout < 14 (qty_needed × sell_price)>,
  "holding_cost_monthly": <estimated monthly holding cost (2% of total inventory value as industry standard)>,
  "potential_savings": <sum of overstock_capital × 0.02 (monthly holding cost)>,
  "skus_overstock": [list of SKU codes that are overstocked],
  "skus_stockout_risk": [list of SKU codes at stockout risk],
  "recommendations": [
    {{
      "action": "description",
      "impact": "cost savings or revenue protection amount",
      "priority": "high|medium|low"
    }}
  ]
}}

INVENTORY DATA:
{context}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)
    
    parsed = _extract_json(raw)
    if parsed:
        # Normalize keys for frontend (snake_case) and ensure lists exist
        total_capital = parsed.get("total_capital_locked")
        if total_capital is None:
            total_capital = sum(s.get("current_stock", 0) * s.get("unit_cost", 0) for s in all_stats)
        overstock = parsed.get("overstock_capital")
        if overstock is None:
            overstock = sum(
                s.get("current_stock", 0) * s.get("unit_cost", 0)
                for s in all_stats
                if s.get("current_stock", 0) > (s.get("avg_daily_demand_30d") or 1) * 90
            )
        result = {
            "total_capital_locked": round(float(total_capital or 0), 2),
            "overstock_capital": round(float(overstock or 0), 2),
            "stockout_risk_cost": round(float(parsed.get("stockout_risk_cost", 0) or 0), 2),
            "holding_cost_monthly": round(float(parsed.get("holding_cost_monthly") or (float(total_capital or 0) * 0.02)), 2),
            "potential_savings": round(float(parsed.get("potential_savings", 0) or 0), 2),
            "skus_overstock": list(parsed.get("skus_overstock") or []),
            "skus_stockout_risk": list(parsed.get("skus_stockout_risk") or []),
            "recommendations": list(parsed.get("recommendations") or []),
        }
        # Ensure each recommendation has action, impact, priority
        for rec in result["recommendations"]:
            if not isinstance(rec, dict):
                continue
            rec.setdefault("action", "")
            rec.setdefault("impact", "")
            rec.setdefault("priority", "medium")
        cache_set("cost_optimization", result)
        return jsonify(result)
    
    # Fallback when LLM response could not be parsed
    total_capital = sum(s.get("current_stock", 0) * s.get("unit_cost", 0) for s in all_stats)
    overstock = sum(
        s.get("current_stock", 0) * s.get("unit_cost", 0)
        for s in all_stats
        if s.get("current_stock", 0) > (s.get("avg_daily_demand_30d") or 1) * 90
    )
    return jsonify({
        "total_capital_locked": round(total_capital, 2),
        "overstock_capital": round(overstock, 2),
        "stockout_risk_cost": 0,
        "holding_cost_monthly": round(total_capital * 0.02, 2),
        "potential_savings": round(overstock * 0.02, 2),
        "skus_overstock": [],
        "skus_stockout_risk": [],
        "recommendations": []
    })


@app.route("/api/scenario-planning", methods=["POST"])
def scenario_planning():
    """Run 'what-if' scenarios on inventory parameters."""
    body = request.get_json()
    
    demand_modifier = body.get("demand_modifier", 1.0)  # e.g., 1.3 = 30% increase
    lead_time_modifier = body.get("lead_time_modifier", 1.0)
    safety_stock_modifier = body.get("safety_stock_modifier", 1.0)
    
    all_stats = get_all_sku_stats()
    context = build_all_skus_context(all_stats)
    
    prompt = f"""Run a scenario analysis with these parameters:
- Demand modifier: {demand_modifier}x (1.0 = no change, 1.3 = 30% increase)
- Lead time modifier: {lead_time_modifier}x
- Safety stock modifier: {safety_stock_modifier}x

For each SKU, calculate:
1. New projected demand
2. New days_until_stockout
3. New reorder point
4. Comparison vs current state

Return ONLY valid JSON (no markdown):
{{
  "scenario_summary": {{
    "demand_change_pct": <percentage>,
    "lead_time_change_pct": <percentage>,
    "safety_stock_change_pct": <percentage>
  }},
  "skus": [
    {{
      "sku": "SKU-CODE",
      "name": "Item name",
      "current": {{
        "avg_daily_demand": <number>,
        "days_until_stockout": <number>,
        "reorder_point": <number>
      }},
      "projected": {{
        "avg_daily_demand": <number>,
        "days_until_stockout": <number>,
        "reorder_point": <number>
      }},
      "impact": "positive|negative|neutral",
      "action_needed": "description"
    }}
  ],
  "overall_impact": {{
    "stockouts_prevented": <count>,
    "new_stockout_risks": <count>,
    "capital_change": <dollar amount>
  }}
}}

CURRENT INVENTORY DATA:
{context}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)
    
    parsed = _extract_json(raw)
    if parsed and isinstance(parsed.get("skus"), list) and isinstance(parsed.get("overall_impact"), dict):
        # Normalize for frontend
        scenario_summary = parsed.get("scenario_summary") or {}
        overall = parsed.get("overall_impact") or {}
        return jsonify({
            "scenario_summary": {
                "demand_change_pct": float(scenario_summary.get("demand_change_pct", (demand_modifier - 1) * 100)),
                "lead_time_change_pct": float(scenario_summary.get("lead_time_change_pct", (lead_time_modifier - 1) * 100)),
                "safety_stock_change_pct": float(scenario_summary.get("safety_stock_change_pct", (safety_stock_modifier - 1) * 100)),
            },
            "skus": parsed.get("skus") or [],
            "overall_impact": {
                "stockouts_prevented": int(overall.get("stockouts_prevented", 0) or 0),
                "new_stockout_risks": int(overall.get("new_stockout_risks", 0) or 0),
                "capital_change": float(overall.get("capital_change", 0) or 0),
            },
        })
    
    # Fallback: compute simple SKU projections from inventory so the UI shows something
    skus_list = []
    for s in all_stats:
        avg_d = s.get("avg_daily_demand_30d") or s.get("avg_daily_demand_7d") or 0
        current_stock = s.get("current_stock", 0)
        days_out = (current_stock / avg_d) if avg_d and avg_d > 0 else 999
        reorder_pt = s.get("reorder_point", 0) or max(0, int(avg_d * (s.get("lead_time_days", 7) or 7)))
        # Apply modifiers to get projected values
        proj_demand = avg_d * demand_modifier
        proj_days_out = (current_stock / proj_demand) if proj_demand and proj_demand > 0 else 999
        proj_reorder = int(reorder_pt * safety_stock_modifier * lead_time_modifier)
        impact = "neutral"
        if proj_days_out < days_out and proj_days_out < 14:
            impact = "negative"
        elif proj_days_out > days_out:
            impact = "positive"
        skus_list.append({
            "sku": s.get("sku", "?"),
            "name": s.get("name", "Unknown"),
            "current": {
                "avg_daily_demand": round(avg_d, 2),
                "days_until_stockout": round(days_out, 0),
                "reorder_point": reorder_pt,
            },
            "projected": {
                "avg_daily_demand": round(proj_demand, 2),
                "days_until_stockout": round(proj_days_out, 0),
                "reorder_point": proj_reorder,
            },
            "impact": impact,
            "action_needed": "Review reorder point and lead time assumptions." if impact != "neutral" else "",
        })
    total_value = sum(s.get("current_stock", 0) * s.get("unit_cost", 0) for s in all_stats)
    capital_change = total_value * (demand_modifier * safety_stock_modifier * (2 - lead_time_modifier) - 1) * 0.1
    return jsonify({
        "scenario_summary": {
            "demand_change_pct": (demand_modifier - 1) * 100,
            "lead_time_change_pct": (lead_time_modifier - 1) * 100,
            "safety_stock_change_pct": (safety_stock_modifier - 1) * 100
        },
        "skus": skus_list,
        "overall_impact": {
            "stockouts_prevented": sum(1 for sku in skus_list if sku["impact"] == "positive" and sku["current"]["days_until_stockout"] < 14),
            "new_stockout_risks": sum(1 for sku in skus_list if sku["impact"] == "negative"),
            "capital_change": round(capital_change, 2)
        }
    })


@app.route("/api/warehouse-optimization", methods=["GET"])
def warehouse_optimization():
    """Detect stock imbalances across warehouses and recommend transfers."""
    if request.args.get("refresh") != "1":
        cached = cache_get("warehouse_optimization")
        if cached:
            return jsonify(cached)

    all_stats = get_all_sku_stats()
    
    # Group by location
    by_location = {}
    for s in all_stats:
        loc = s.get("location", "Unknown")
        if loc not in by_location:
            by_location[loc] = []
        by_location[loc].append(s)
    
    context = build_all_skus_context(all_stats)
    location_summary = "\n".join([
        f"{loc}: {len(items)} SKUs, total stock value: ₹{sum(i.get('current_stock', 0) * i.get('unit_cost', 0) for i in items):.2f}"
        for loc, items in by_location.items()
    ])
    
    prompt = f"""Analyze inventory distribution across warehouses and recommend transfers.

WAREHOUSE SUMMARY:
{location_summary}

DETAILED INVENTORY DATA:
{context}

Identify:
1. SKUs with stock imbalance (overstock in one location, stockout risk in another)
2. Recommended inter-warehouse transfers
3. Cost-benefit analysis of transfers vs stockouts

Return ONLY valid JSON (no markdown):
{{
  "warehouses": [
    {{
      "location": "Warehouse Name",
      "total_skus": <count>,
      "total_value": <dollar amount>,
      "overstock_items": <count>,
      "stockout_risk_items": <count>
    }}
  ],
  "transfer_recommendations": [
    {{
      "sku": "SKU-CODE",
      "name": "Item name",
      "from_location": "source warehouse",
      "to_location": "destination warehouse",
      "qty_to_transfer": <number>,
      "reason": "explanation",
      "transfer_cost_estimate": <dollar amount>,
      "stockout_cost_prevented": <dollar amount>,
      "net_benefit": <dollar amount>,
      "priority": "high|medium|low"
    }}
  ],
  "network_health_score": <0-100, where 100=perfect balance>,
  "total_transfer_savings": <total net benefit of all transfers>
}}"""

    raw = call_llm(SYSTEM_PROMPT, prompt)
    
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
        parsed = json.loads(cleaned)
        cache_set("warehouse_optimization", parsed)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({
            "warehouses": [
                {
                    "location": loc,
                    "total_skus": len(items),
                    "total_value": sum(i.get("current_stock", 0) * i.get("unit_cost", 0) for i in items),
                    "overstock_items": 0,
                    "stockout_risk_items": 0
                }
                for loc, items in by_location.items()
            ],
            "transfer_recommendations": [],
            "network_health_score": 50,
            "total_transfer_savings": 0
        })


# ── AI Onboarding Catalog Generator ──────────────────────────────────────────

_FALLBACK_CATALOGS = {
    "Food & Restaurant": [
        {"name": "Fresh Whole Milk (1 Litre Pouch)", "sku": "DRY-001", "category": "Raw Dairy", "quantity": 250, "unitCost": 52, "sellPrice": 66, "reorderPoint": 50, "location": "Cold Storage A"},
        {"name": "Pasteurized Toned Milk (500ml Pack)", "sku": "DRY-002", "category": "Raw Dairy", "quantity": 300, "unitCost": 26, "sellPrice": 33, "reorderPoint": 60, "location": "Cold Storage A"},
        {"name": "Fresh Farm Cottage Cheese / Paneer 500g", "sku": "DRY-003", "category": "Raw Dairy", "quantity": 120, "unitCost": 160, "sellPrice": 220, "reorderPoint": 25, "location": "Cold Storage A"},
        {"name": "Salted Creamery Butter 500g Pack", "sku": "DRY-004", "category": "Raw Dairy", "quantity": 180, "unitCost": 210, "sellPrice": 275, "reorderPoint": 30, "location": "Cold Storage A"},
        {"name": "Pure Desi Cow Ghee (1 Litre Jar)", "sku": "DRY-005", "category": "Raw Dairy", "quantity": 90, "unitCost": 520, "sellPrice": 680, "reorderPoint": 20, "location": "Main Pantry"},
        {"name": "Fresh Dairy Whipping Cream 250ml", "sku": "DRY-006", "category": "Raw Dairy", "quantity": 100, "unitCost": 65, "sellPrice": 95, "reorderPoint": 20, "location": "Cold Storage A"},
        {"name": "Mozzarella Cheese Block (1kg Pack)", "sku": "DRY-007", "category": "Raw Dairy", "quantity": 75, "unitCost": 380, "sellPrice": 520, "reorderPoint": 15, "location": "Cold Storage A"},
        {"name": "Processed Cheese Slices (200g Pack)", "sku": "DRY-008", "category": "Raw Dairy", "quantity": 140, "unitCost": 110, "sellPrice": 155, "reorderPoint": 30, "location": "Cold Storage A"},
        {"name": "Plain Fresh Set Curd / Dahi 500g", "sku": "DRY-009", "category": "Raw Dairy", "quantity": 210, "unitCost": 38, "sellPrice": 50, "reorderPoint": 40, "location": "Cold Storage A"},
        {"name": "Full-Cream Milk Powder (1kg Bag)", "sku": "DRY-010", "category": "Raw Dairy", "quantity": 60, "unitCost": 340, "sellPrice": 440, "reorderPoint": 12, "location": "Main Pantry"},
        {"name": "Sweetened Condensed Milk 400g Tin", "sku": "DRY-011", "category": "Raw Dairy", "quantity": 85, "unitCost": 90, "sellPrice": 130, "reorderPoint": 15, "location": "Main Pantry"},
        {"name": "Premium Basmati Biryani Rice 5kg", "sku": "GRN-001", "category": "Grains & Rice", "quantity": 150, "unitCost": 420, "sellPrice": 620, "reorderPoint": 30, "location": "Main Pantry"},
        {"name": "Organic Whole Wheat Atta 10kg", "sku": "STP-001", "category": "Flour & Staples", "quantity": 110, "unitCost": 350, "sellPrice": 460, "reorderPoint": 20, "location": "Main Pantry"},
        {"name": "Refined Sunflower Cooking Oil 5L", "sku": "OIL-001", "category": "Oils & Fats", "quantity": 95, "unitCost": 580, "sellPrice": 750, "reorderPoint": 20, "location": "Main Pantry"},
        {"name": "Cold Pressed Mustard Oil 1L", "sku": "OIL-002", "category": "Oils & Fats", "quantity": 130, "unitCost": 125, "sellPrice": 170, "reorderPoint": 25, "location": "Main Pantry"},
        {"name": "Unpolished Toor Dal (Pigeon Pea) 2kg", "sku": "PLS-001", "category": "Pulses & Legumes", "quantity": 140, "unitCost": 220, "sellPrice": 310, "reorderPoint": 25, "location": "Main Pantry"},
        {"name": "Organic Chana Dal (Bengal Gram) 1kg", "sku": "PLS-002", "category": "Pulses & Legumes", "quantity": 160, "unitCost": 80, "sellPrice": 115, "reorderPoint": 30, "location": "Main Pantry"},
        {"name": "Premium Red Kidney Beans / Rajma 1kg", "sku": "PLS-003", "category": "Pulses & Legumes", "quantity": 125, "unitCost": 110, "sellPrice": 160, "reorderPoint": 20, "location": "Main Pantry"},
        {"name": "Special Garam Masala Powder 200g", "sku": "SPC-001", "category": "Spices & Seasonings", "quantity": 180, "unitCost": 75, "sellPrice": 120, "reorderPoint": 35, "location": "Main Pantry"},
        {"name": "Organic Turmeric Powder / Haldi 500g", "sku": "SPC-002", "category": "Spices & Seasonings", "quantity": 190, "unitCost": 90, "sellPrice": 140, "reorderPoint": 35, "location": "Main Pantry"},
        {"name": "Kashmiri Red Chilli Powder 200g", "sku": "SPC-003", "category": "Spices & Seasonings", "quantity": 175, "unitCost": 85, "sellPrice": 135, "reorderPoint": 30, "location": "Main Pantry"},
        {"name": "Pure Iodized Table Salt 1kg Pack", "sku": "STP-002", "category": "Flour & Staples", "quantity": 400, "unitCost": 18, "sellPrice": 28, "reorderPoint": 80, "location": "Main Pantry"},
        {"name": "Refined White Sugar 5kg Bag", "sku": "STP-003", "category": "Flour & Staples", "quantity": 130, "unitCost": 200, "sellPrice": 260, "reorderPoint": 25, "location": "Main Pantry"},
        {"name": "Raw Assam Black Tea Leaf 500g", "sku": "BEV-001", "category": "Beverages", "quantity": 110, "unitCost": 160, "sellPrice": 240, "reorderPoint": 20, "location": "Main Pantry"},
        {"name": "Freeze Dried Instant Coffee Powder 200g", "sku": "BEV-002", "category": "Beverages", "quantity": 90, "unitCost": 220, "sellPrice": 340, "reorderPoint": 15, "location": "Main Pantry"},
        {"name": "Rich Tomato Ketchup Bottle 1kg", "sku": "CND-001", "category": "Condiments", "quantity": 140, "unitCost": 85, "sellPrice": 135, "reorderPoint": 25, "location": "Main Pantry"},
        {"name": "Spicy Green Chilli Sauce 500ml", "sku": "CND-002", "category": "Condiments", "quantity": 120, "unitCost": 45, "sellPrice": 75, "reorderPoint": 20, "location": "Main Pantry"},
        {"name": "Authentic Dark Soy Sauce 500ml", "sku": "CND-003", "category": "Condiments", "quantity": 105, "unitCost": 55, "sellPrice": 90, "reorderPoint": 18, "location": "Main Pantry"},
        {"name": "Pure Wildflower Natural Honey 500g", "sku": "CND-004", "category": "Condiments", "quantity": 85, "unitCost": 180, "sellPrice": 270, "reorderPoint": 15, "location": "Main Pantry"},
        {"name": "Dry Roasted Jumbo Almonds 500g", "sku": "DFT-001", "category": "Dry Fruits", "quantity": 70, "unitCost": 380, "sellPrice": 560, "reorderPoint": 12, "location": "Main Pantry"}
    ],
    "Electronics & Gadgets": [
        {"name": "Wireless Noise Cancelling Earbuds", "sku": "ELC-001", "category": "Audio", "quantity": 45, "unitCost": 1800, "sellPrice": 3499, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "65W Fast Charging USB-C Adapter", "sku": "ELC-002", "category": "Accessories", "quantity": 120, "unitCost": 450, "sellPrice": 999, "reorderPoint": 25, "location": "Main Warehouse"},
        {"name": "RGB Mechanical Gaming Keyboard", "sku": "ELC-003", "category": "Peripherals", "quantity": 30, "unitCost": 2200, "sellPrice": 4299, "reorderPoint": 8, "location": "Store Front"},
        {"name": "Ultra-Wide 27-inch 4K Monitor", "sku": "ELC-004", "category": "Displays", "quantity": 15, "unitCost": 14500, "sellPrice": 21999, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "20000mAh Slim Power Bank", "sku": "ELC-005", "category": "Accessories", "quantity": 80, "unitCost": 800, "sellPrice": 1599, "reorderPoint": 15, "location": "Store Front"},
        {"name": "Full HD Web Camera 1080p", "sku": "ELC-006", "category": "Peripherals", "quantity": 50, "unitCost": 950, "sellPrice": 1899, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "Smart Fitness Watch Series 5", "sku": "ELC-007", "category": "Wearables", "quantity": 60, "unitCost": 1500, "sellPrice": 2999, "reorderPoint": 12, "location": "Store Front"},
        {"name": "Ergonomic Wireless Mouse", "sku": "ELC-008", "category": "Peripherals", "quantity": 90, "unitCost": 350, "sellPrice": 799, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "USB-C Multi-Port Hub 7-in-1", "sku": "ELC-009", "category": "Accessories", "quantity": 40, "unitCost": 1100, "sellPrice": 2199, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "Portable Bluetooth Speaker 20W", "sku": "ELC-010", "category": "Audio", "quantity": 35, "unitCost": 1400, "sellPrice": 2799, "reorderPoint": 8, "location": "Store Front"},
        {"name": "PCIe NVMe M.2 1TB Internal SSD", "sku": "ELC-011", "category": "Components", "quantity": 25, "unitCost": 3800, "sellPrice": 5999, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "16GB DDR4 3200MHz RAM Module", "sku": "ELC-012", "category": "Components", "quantity": 30, "unitCost": 2100, "sellPrice": 3499, "reorderPoint": 8, "location": "Main Warehouse"},
        {"name": "Wi-Fi 6 Dual-Band Gigabit Router", "sku": "ELC-013", "category": "Networking", "quantity": 20, "unitCost": 1900, "sellPrice": 3299, "reorderPoint": 5, "location": "Store Front"},
        {"name": "High-Speed Braided HDMI 2.1 Cable 2m", "sku": "ELC-014", "category": "Cables", "quantity": 100, "unitCost": 250, "sellPrice": 599, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "USB Studio Condenser Microphone", "sku": "ELC-015", "category": "Audio", "quantity": 18, "unitCost": 2500, "sellPrice": 4499, "reorderPoint": 4, "location": "Store Front"},
        {"name": "Smart Home Security Camera 1080p", "sku": "ELC-016", "category": "Smart Home", "quantity": 45, "unitCost": 1200, "sellPrice": 2299, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "15W Fast Qi Wireless Charging Pad", "sku": "ELC-017", "category": "Accessories", "quantity": 65, "unitCost": 400, "sellPrice": 899, "reorderPoint": 15, "location": "Store Front"},
        {"name": "PBT Custom Mechanical Keycap Set", "sku": "ELC-018", "category": "Peripherals", "quantity": 22, "unitCost": 850, "sellPrice": 1699, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "Foldable Aluminum Laptop Stand", "sku": "ELC-019", "category": "Accessories", "quantity": 55, "unitCost": 650, "sellPrice": 1299, "reorderPoint": 12, "location": "Store Front"},
        {"name": "In-Ear Active Noise Isolating Earbuds", "sku": "ELC-020", "category": "Audio", "quantity": 70, "unitCost": 750, "sellPrice": 1499, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Digital Graphic Drawing Tablet 10-inch", "sku": "ELC-021", "category": "Peripherals", "quantity": 15, "unitCost": 3200, "sellPrice": 5499, "reorderPoint": 4, "location": "Store Front"},
        {"name": "2TB USB 3.2 External Hard Drive", "sku": "ELC-022", "category": "Storage", "quantity": 28, "unitCost": 3900, "sellPrice": 5799, "reorderPoint": 6, "location": "Main Warehouse"},
        {"name": "6-Socket Surge Protector Extension Cord", "sku": "ELC-023", "category": "Power", "quantity": 85, "unitCost": 380, "sellPrice": 799, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Smart RGB LED Light Bulb 12W", "sku": "ELC-024", "category": "Smart Home", "quantity": 110, "unitCost": 300, "sellPrice": 649, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Tempered Anti-Glare Monitor Screen Guard", "sku": "ELC-025", "category": "Accessories", "quantity": 40, "unitCost": 220, "sellPrice": 499, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "Ergonomic Vertical Wireless Mouse", "sku": "ELC-026", "category": "Peripherals", "quantity": 32, "unitCost": 600, "sellPrice": 1299, "reorderPoint": 8, "location": "Store Front"},
        {"name": "Heavy-Duty Dual Monitor Arm Stand", "sku": "ELC-027", "category": "Accessories", "quantity": 14, "unitCost": 2100, "sellPrice": 3899, "reorderPoint": 3, "location": "Main Warehouse"},
        {"name": "Heavy-Duty Braided Type-C Cable 2m", "sku": "ELC-028", "category": "Cables", "quantity": 130, "unitCost": 120, "sellPrice": 349, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Intel Core i5 Mini PC Barebone Kit", "sku": "ELC-029", "category": "Computers", "quantity": 10, "unitCost": 18500, "sellPrice": 26999, "reorderPoint": 2, "location": "Main Warehouse"},
        {"name": "Stereo Desktop Speakers 2.0 10W", "sku": "ELC-030", "category": "Audio", "quantity": 38, "unitCost": 550, "sellPrice": 1199, "reorderPoint": 9, "location": "Store Front"}
    ],
    "Pharmacy & Healthcare": [
        {"name": "Paracetamol 650mg Tablets (Strip of 15)", "sku": "PHM-001", "category": "OTC Medicine", "quantity": 500, "unitCost": 12, "sellPrice": 30, "reorderPoint": 100, "location": "Pharmacy Shelf A"},
        {"name": "Vitamin C + Zinc Chewable (30 Tabs)", "sku": "PHM-002", "category": "Supplements", "quantity": 150, "unitCost": 85, "sellPrice": 175, "reorderPoint": 30, "location": "Pharmacy Shelf B"},
        {"name": "Digital Infrared Thermometer", "sku": "PHM-003", "category": "Devices", "quantity": 40, "unitCost": 650, "sellPrice": 1299, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "Automatic Blood Pressure Monitor", "sku": "PHM-004", "category": "Devices", "quantity": 25, "unitCost": 1100, "sellPrice": 1999, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "Antiseptic Liquid 500ml", "sku": "PHM-005", "category": "First Aid", "quantity": 100, "unitCost": 90, "sellPrice": 145, "reorderPoint": 20, "location": "Pharmacy Shelf A"},
        {"name": "Fingertip Pulse Oximeter OLED", "sku": "PHM-006", "category": "Devices", "quantity": 35, "unitCost": 450, "sellPrice": 999, "reorderPoint": 8, "location": "Pharmacy Shelf B"},
        {"name": "N95 Protective Face Masks (Pack of 10)", "sku": "PHM-007", "category": "Personal Safety", "quantity": 200, "unitCost": 120, "sellPrice": 250, "reorderPoint": 40, "location": "Main Warehouse"},
        {"name": "Absorbent Surgical Cotton 500g", "sku": "PHM-008", "category": "First Aid", "quantity": 80, "unitCost": 95, "sellPrice": 160, "reorderPoint": 15, "location": "Pharmacy Shelf A"},
        {"name": "Microporous Medical Tape 1 inch", "sku": "PHM-009", "category": "First Aid", "quantity": 120, "unitCost": 35, "sellPrice": 65, "reorderPoint": 25, "location": "Pharmacy Shelf A"},
        {"name": "Elastic Bandage Roll 4 inch", "sku": "PHM-010", "category": "First Aid", "quantity": 140, "unitCost": 45, "sellPrice": 85, "reorderPoint": 30, "location": "Pharmacy Shelf A"},
        {"name": "Oral Rehydration Salts (ORS) 21g Sachet", "sku": "PHM-011", "category": "OTC Medicine", "quantity": 600, "unitCost": 6, "sellPrice": 18, "reorderPoint": 120, "location": "Pharmacy Shelf B"},
        {"name": "Herbal Cough Syrup Honey Formula 100ml", "sku": "PHM-012", "category": "OTC Medicine", "quantity": 130, "unitCost": 60, "sellPrice": 110, "reorderPoint": 25, "location": "Pharmacy Shelf A"},
        {"name": "Antacid Chewable Mint Tablets (Strip of 10)", "sku": "PHM-013", "category": "OTC Medicine", "quantity": 300, "unitCost": 15, "sellPrice": 35, "reorderPoint": 50, "location": "Pharmacy Shelf A"},
        {"name": "Daily Multivitamin Capsules (30 Count)", "sku": "PHM-014", "category": "Supplements", "quantity": 95, "unitCost": 140, "sellPrice": 280, "reorderPoint": 20, "location": "Pharmacy Shelf B"},
        {"name": "Calcium + Vitamin D3 Tablets (30 Tabs)", "sku": "PHM-015", "category": "Supplements", "quantity": 110, "unitCost": 120, "sellPrice": 240, "reorderPoint": 20, "location": "Pharmacy Shelf B"},
        {"name": "Antiseptic Skin Cream 30g Tube", "sku": "PHM-016", "category": "First Aid", "quantity": 150, "unitCost": 30, "sellPrice": 60, "reorderPoint": 30, "location": "Pharmacy Shelf A"},
        {"name": "Instant Hand Sanitizer Gel 500ml", "sku": "PHM-017", "category": "Personal Safety", "quantity": 180, "unitCost": 80, "sellPrice": 150, "reorderPoint": 35, "location": "Main Warehouse"},
        {"name": "Blood Glucose Test Strips (50 Strips)", "sku": "PHM-018", "category": "Devices", "quantity": 50, "unitCost": 420, "sellPrice": 750, "reorderPoint": 10, "location": "Pharmacy Shelf B"},
        {"name": "Powdered Latex Gloves (Box of 100)", "sku": "PHM-019", "category": "Personal Safety", "quantity": 90, "unitCost": 220, "sellPrice": 399, "reorderPoint": 18, "location": "Main Warehouse"},
        {"name": "Hydrogen Peroxide Solution 6% 400ml", "sku": "PHM-020", "category": "First Aid", "quantity": 70, "unitCost": 28, "sellPrice": 55, "reorderPoint": 12, "location": "Pharmacy Shelf A"},
        {"name": "Fast Pain Relief Spray 100g", "sku": "PHM-021", "category": "OTC Medicine", "quantity": 120, "unitCost": 90, "sellPrice": 165, "reorderPoint": 25, "location": "Pharmacy Shelf A"},
        {"name": "Lubricating Eye Drops 10ml", "sku": "PHM-022", "category": "OTC Medicine", "quantity": 85, "unitCost": 75, "sellPrice": 140, "reorderPoint": 15, "location": "Pharmacy Shelf A"},
        {"name": "Digital Flexible Tip Thermometer", "sku": "PHM-023", "category": "Devices", "quantity": 60, "unitCost": 150, "sellPrice": 299, "reorderPoint": 12, "location": "Pharmacy Shelf B"},
        {"name": "Orthopedic Heating Gel Pad Electric", "sku": "PHM-024", "category": "Devices", "quantity": 25, "unitCost": 480, "sellPrice": 899, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "Soothing Vaporizing Rub 50g Jar", "sku": "PHM-025", "category": "OTC Medicine", "quantity": 160, "unitCost": 50, "sellPrice": 95, "reorderPoint": 30, "location": "Pharmacy Shelf A"},
        {"name": "Adjustable Medical Face Shield", "sku": "PHM-026", "category": "Personal Safety", "quantity": 110, "unitCost": 40, "sellPrice": 85, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Menthol Throat Lozenges (Box of 20)", "sku": "PHM-027", "category": "OTC Medicine", "quantity": 220, "unitCost": 25, "sellPrice": 55, "reorderPoint": 40, "location": "Pharmacy Shelf A"},
        {"name": "Antiallergic Cetirizine 10mg (Strip of 10)", "sku": "PHM-028", "category": "OTC Medicine", "quantity": 400, "unitCost": 8, "sellPrice": 22, "reorderPoint": 80, "location": "Pharmacy Shelf A"},
        {"name": "Comprehensive Emergency First Aid Kit", "sku": "PHM-029", "category": "First Aid", "quantity": 30, "unitCost": 380, "sellPrice": 699, "reorderPoint": 6, "location": "Main Warehouse"},
        {"name": "Antifungal Clotrimazole Cream 30g", "sku": "PHM-030", "category": "OTC Medicine", "quantity": 130, "unitCost": 35, "sellPrice": 70, "reorderPoint": 25, "location": "Pharmacy Shelf A"}
    ],
    "Apparel & Fashion": [
        {"name": "Men's Slim Fit Stretch Denim Jeans", "sku": "APP-001", "category": "Bottomwear", "quantity": 80, "unitCost": 650, "sellPrice": 1499, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Women's Printed Cotton Kurti", "sku": "APP-002", "category": "Ethnicwear", "quantity": 110, "unitCost": 380, "sellPrice": 899, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Heavyweight Cotton Crewneck T-Shirt", "sku": "APP-003", "category": "Topwear", "quantity": 200, "unitCost": 220, "sellPrice": 599, "reorderPoint": 40, "location": "Store Front"},
        {"name": "Men's Casual Button-Down Shirt", "sku": "APP-004", "category": "Topwear", "quantity": 90, "unitCost": 480, "sellPrice": 1199, "reorderPoint": 18, "location": "Main Warehouse"},
        {"name": "Fleece Oversized Pullover Hoodie", "sku": "APP-005", "category": "Winterwear", "quantity": 65, "unitCost": 750, "sellPrice": 1799, "reorderPoint": 12, "location": "Store Front"},
        {"name": "Formal Trousers Regular Fit Navy", "sku": "APP-006", "category": "Bottomwear", "quantity": 70, "unitCost": 580, "sellPrice": 1399, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Athletic Quick-Dry Running Shorts", "sku": "APP-007", "category": "Activewear", "quantity": 120, "unitCost": 280, "sellPrice": 699, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Genuine Leather Belt Brown", "sku": "APP-008", "category": "Accessories", "quantity": 150, "unitCost": 180, "sellPrice": 499, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Ankle Length Cotton Socks (3 Pack)", "sku": "APP-009", "category": "Accessories", "quantity": 250, "unitCost": 90, "sellPrice": 249, "reorderPoint": 50, "location": "Store Front"},
        {"name": "Vintage Wash Denim Trucker Jacket", "sku": "APP-010", "category": "Outerwear", "quantity": 40, "unitCost": 1100, "sellPrice": 2499, "reorderPoint": 8, "location": "Main Warehouse"},
        {"name": "Women's High-Waist Ankle Leggings", "sku": "APP-011", "category": "Bottomwear", "quantity": 130, "unitCost": 250, "sellPrice": 599, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Unisex Classic Canvas Sneakers", "sku": "APP-012", "category": "Footwear", "quantity": 60, "unitCost": 620, "sellPrice": 1499, "reorderPoint": 12, "location": "Main Warehouse"},
        {"name": "Men's Formal Oxford Shoes Black", "sku": "APP-013", "category": "Footwear", "quantity": 45, "unitCost": 950, "sellPrice": 2299, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "Insulated Winter Puffer Jacket", "sku": "APP-014", "category": "Winterwear", "quantity": 35, "unitCost": 1400, "sellPrice": 3299, "reorderPoint": 6, "location": "Main Warehouse"},
        {"name": "Pure Linen Summer Casual Shirt", "sku": "APP-015", "category": "Topwear", "quantity": 55, "unitCost": 680, "sellPrice": 1699, "reorderPoint": 10, "location": "Store Front"},
        {"name": "Women's High-Support Sports Bra", "sku": "APP-016", "category": "Activewear", "quantity": 95, "unitCost": 320, "sellPrice": 799, "reorderPoint": 18, "location": "Store Front"},
        {"name": "Stretch Cotton Chino Shorts", "sku": "APP-017", "category": "Bottomwear", "quantity": 85, "unitCost": 390, "sellPrice": 899, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Graphic Printed Streetwear Tee", "sku": "APP-018", "category": "Topwear", "quantity": 180, "unitCost": 240, "sellPrice": 649, "reorderPoint": 35, "location": "Store Front"},
        {"name": "Slim Leather Bifold Wallet", "sku": "APP-019", "category": "Accessories", "quantity": 110, "unitCost": 210, "sellPrice": 549, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Lightweight Waterproof Windbreaker", "sku": "APP-020", "category": "Outerwear", "quantity": 50, "unitCost": 780, "sellPrice": 1899, "reorderPoint": 10, "location": "Main Warehouse"},
        {"name": "Tailored Single-Breasted Blazer", "sku": "APP-021", "category": "Formalwear", "quantity": 30, "unitCost": 1850, "sellPrice": 4299, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "Pure Cotton Nightwear Pajama Set", "sku": "APP-022", "category": "Sleepwear", "quantity": 75, "unitCost": 420, "sellPrice": 999, "reorderPoint": 15, "location": "Store Front"},
        {"name": "Polo Collar Cotton Pique T-Shirt", "sku": "APP-023", "category": "Topwear", "quantity": 140, "unitCost": 350, "sellPrice": 799, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Ribbed Woolen Beanie Cap", "sku": "APP-024", "category": "Accessories", "quantity": 120, "unitCost": 110, "sellPrice": 349, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Polarized Aviator Sunglasses UV400", "sku": "APP-025", "category": "Accessories", "quantity": 90, "unitCost": 280, "sellPrice": 799, "reorderPoint": 18, "location": "Store Front"},
        {"name": "Formal Silk Patterned Necktie", "sku": "APP-026", "category": "Accessories", "quantity": 80, "unitCost": 160, "sellPrice": 449, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Oversized Streetwear Fleece Hoodie", "sku": "APP-027", "category": "Topwear", "quantity": 70, "unitCost": 820, "sellPrice": 1999, "reorderPoint": 12, "location": "Store Front"},
        {"name": "Slim Fit Cuffed Track Pants", "sku": "APP-028", "category": "Activewear", "quantity": 100, "unitCost": 450, "sellPrice": 1099, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Women's Printed Floral Maxi Dress", "sku": "APP-029", "category": "Dresses", "quantity": 50, "unitCost": 720, "sellPrice": 1799, "reorderPoint": 10, "location": "Store Front"},
        {"name": "Leather Shoulder Crossbody Bag", "sku": "APP-030", "category": "Accessories", "quantity": 40, "unitCost": 890, "sellPrice": 2199, "reorderPoint": 8, "location": "Main Warehouse"}
    ],
    "Hardware & Industrial": [
        {"name": "18V Cordless Impact Drill Kit", "sku": "HWD-001", "category": "Power Tools", "quantity": 25, "unitCost": 2800, "sellPrice": 4999, "reorderPoint": 5, "location": "Main Warehouse"},
        {"name": "Stainless Steel Wood Screws M4 (Box of 500)", "sku": "HWD-002", "category": "Fasteners", "quantity": 100, "unitCost": 180, "sellPrice": 399, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Industrial Safety Helmet Yellow", "sku": "HWD-003", "category": "Safety Gear", "quantity": 80, "unitCost": 220, "sellPrice": 499, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Digital Vernier Caliper 150mm Stainless", "sku": "HWD-004", "category": "Measuring", "quantity": 30, "unitCost": 650, "sellPrice": 1399, "reorderPoint": 6, "location": "Store Front"},
        {"name": "Heavy-Duty Angle Grinder 850W", "sku": "HWD-005", "category": "Power Tools", "quantity": 20, "unitCost": 1600, "sellPrice": 2899, "reorderPoint": 4, "location": "Main Warehouse"},
        {"name": "Combination Pliers 8-inch Insulated", "sku": "HWD-006", "category": "Hand Tools", "quantity": 90, "unitCost": 190, "sellPrice": 420, "reorderPoint": 18, "location": "Store Front"},
        {"name": "Adjustable Pipe Wrench 12-inch Heavy Duty", "sku": "HWD-007", "category": "Hand Tools", "quantity": 40, "unitCost": 340, "sellPrice": 750, "reorderPoint": 8, "location": "Main Warehouse"},
        {"name": "Anti-Skid Cut Resistant Gloves (Pair)", "sku": "HWD-008", "category": "Safety Gear", "quantity": 150, "unitCost": 75, "sellPrice": 160, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Steel Measuring Tape 5m Auto-Lock", "sku": "HWD-009", "category": "Measuring", "quantity": 110, "unitCost": 85, "sellPrice": 199, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Rechargeable LED Work Floodlight 30W", "sku": "HWD-010", "category": "Lighting", "quantity": 35, "unitCost": 750, "sellPrice": 1599, "reorderPoint": 7, "location": "Main Warehouse"},
        {"name": "Fiberglass Handle Claw Hammer 500g", "sku": "HWD-011", "category": "Hand Tools", "quantity": 65, "unitCost": 210, "sellPrice": 450, "reorderPoint": 12, "location": "Store Front"},
        {"name": "Precision Magnetic Screwdriver Set (32 pc)", "sku": "HWD-012", "category": "Hand Tools", "quantity": 50, "unitCost": 280, "sellPrice": 649, "reorderPoint": 10, "location": "Store Front"},
        {"name": "Dual-Temp Heat Gun 2000W", "sku": "HWD-013", "category": "Power Tools", "quantity": 18, "unitCost": 1100, "sellPrice": 2199, "reorderPoint": 4, "location": "Main Warehouse"},
        {"name": "Soldering Iron Station 60W Digital", "sku": "HWD-014", "category": "Electrical", "quantity": 28, "unitCost": 850, "sellPrice": 1799, "reorderPoint": 5, "location": "Store Front"},
        {"name": "WD-40 Rust Remover & Lubricant 420ml", "sku": "HWD-015", "category": "Chemicals", "quantity": 120, "unitCost": 210, "sellPrice": 380, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Anti-Fog Clear Safety Goggles", "sku": "HWD-016", "category": "Safety Gear", "quantity": 140, "unitCost": 60, "sellPrice": 140, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Heavy Duty Nylon Cable Ties 300mm (Pack of 100)", "sku": "HWD-017", "category": "Supplies", "quantity": 200, "unitCost": 65, "sellPrice": 150, "reorderPoint": 40, "location": "Main Warehouse"},
        {"name": "Hydraulic Bottle Jack 5 Ton Capacity", "sku": "HWD-018", "category": "Equipment", "quantity": 15, "unitCost": 1250, "sellPrice": 2499, "reorderPoint": 3, "location": "Main Warehouse"},
        {"name": "Heavy Duty Utility Cutter Knife", "sku": "HWD-019", "category": "Hand Tools", "quantity": 130, "unitCost": 45, "sellPrice": 110, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Aluminum Spirit Level 24-inch Magnetic", "sku": "HWD-020", "category": "Measuring", "quantity": 45, "unitCost": 320, "sellPrice": 699, "reorderPoint": 9, "location": "Main Warehouse"},
        {"name": "Automatic Wire Stripper & Crimper", "sku": "HWD-021", "category": "Electrical", "quantity": 55, "unitCost": 290, "sellPrice": 649, "reorderPoint": 10, "location": "Store Front"},
        {"name": "Heavy Duty Cantilever Steel Tool Box", "sku": "HWD-022", "category": "Storage", "quantity": 22, "unitCost": 980, "sellPrice": 1999, "reorderPoint": 4, "location": "Main Warehouse"},
        {"name": "Ratchet Socket Wrench Set 40-Piece", "sku": "HWD-023", "category": "Hand Tools", "quantity": 30, "unitCost": 850, "sellPrice": 1799, "reorderPoint": 6, "location": "Store Front"},
        {"name": "PVC Flame Retardant Insulation Tape 10m", "sku": "HWD-024", "category": "Electrical", "quantity": 350, "unitCost": 15, "sellPrice": 35, "reorderPoint": 70, "location": "Store Front"},
        {"name": "Solid Brass Security Padlock 50mm", "sku": "HWD-025", "category": "Hardware", "quantity": 75, "unitCost": 180, "sellPrice": 399, "reorderPoint": 15, "location": "Store Front"},
        {"name": "Hex Allen Key Wrench Set Metric (9 pc)", "sku": "HWD-026", "category": "Hand Tools", "quantity": 85, "unitCost": 140, "sellPrice": 320, "reorderPoint": 18, "location": "Store Front"},
        {"name": "Malleable Cast Iron C-Clamp 6-inch", "sku": "HWD-027", "category": "Hardware", "quantity": 40, "unitCost": 240, "sellPrice": 520, "reorderPoint": 8, "location": "Main Warehouse"},
        {"name": "Industrial Dual Filter Respirator Mask", "sku": "HWD-028", "category": "Safety Gear", "quantity": 30, "unitCost": 480, "sellPrice": 999, "reorderPoint": 6, "location": "Main Warehouse"},
        {"name": "Silicon Carbide Sandpaper Sheets Assorted (Pack of 10)", "sku": "HWD-029", "category": "Supplies", "quantity": 160, "unitCost": 50, "sellPrice": 120, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Epoxy Steel Weld Compound 50g", "sku": "HWD-030", "category": "Chemicals", "quantity": 110, "unitCost": 85, "sellPrice": 180, "reorderPoint": 20, "location": "Store Front"}
    ],
    "FMCG & Grocery": [
        {"name": "Fresh Whole Milk 1 Litre Pouch", "sku": "FMC-001", "category": "Dairy", "quantity": 200, "unitCost": 52, "sellPrice": 66, "reorderPoint": 40, "location": "Cold Storage A"},
        {"name": "Fresh Cottage Cheese Paneer 200g", "sku": "FMC-002", "category": "Dairy", "quantity": 100, "unitCost": 75, "sellPrice": 105, "reorderPoint": 20, "location": "Cold Storage A"},
        {"name": "Salted Dairy Butter 500g", "sku": "FMC-003", "category": "Dairy", "quantity": 120, "unitCost": 210, "sellPrice": 275, "reorderPoint": 25, "location": "Cold Storage A"},
        {"name": "Basmati Premium Rice 5kg", "sku": "FMC-004", "category": "Staples", "quantity": 150, "unitCost": 320, "sellPrice": 499, "reorderPoint": 30, "location": "Main Warehouse"},
        {"name": "Refined Sunflower Oil 1L", "sku": "FMC-005", "category": "Oils & Ghee", "quantity": 200, "unitCost": 110, "sellPrice": 145, "reorderPoint": 40, "location": "Store Front"},
        {"name": "Organic Whole Wheat Atta 10kg", "sku": "FMC-006", "category": "Staples", "quantity": 100, "unitCost": 340, "sellPrice": 450, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Dark Chocolate Roasted Almond Bar", "sku": "FMC-007", "category": "Snacks", "quantity": 300, "unitCost": 45, "sellPrice": 90, "reorderPoint": 50, "location": "Store Front"},
        {"name": "Green Tea Honey Lemon 100g", "sku": "FMC-008", "category": "Beverages", "quantity": 80, "unitCost": 130, "sellPrice": 220, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Antibacterial Hand Wash 500ml", "sku": "FMC-009", "category": "Personal Care", "quantity": 120, "unitCost": 70, "sellPrice": 135, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Pure Desi Cow Ghee 1L Jar", "sku": "FMC-010", "category": "Dairy", "quantity": 80, "unitCost": 520, "sellPrice": 680, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Instant Noodles Masala (Pack of 12)", "sku": "FMC-011", "category": "Snacks", "quantity": 250, "unitCost": 120, "sellPrice": 168, "reorderPoint": 40, "location": "Store Front"},
        {"name": "Crispy Potato Chips Salted 100g", "sku": "FMC-012", "category": "Snacks", "quantity": 350, "unitCost": 22, "sellPrice": 40, "reorderPoint": 60, "location": "Store Front"},
        {"name": "Sparkling Carbonated Soda 1.5L", "sku": "FMC-013", "category": "Beverages", "quantity": 180, "unitCost": 45, "sellPrice": 75, "reorderPoint": 30, "location": "Main Warehouse"},
        {"name": "Natural Orange Juice 1L Carton", "sku": "FMC-014", "category": "Beverages", "quantity": 90, "unitCost": 85, "sellPrice": 130, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Moisturizing Bathing Soap (Pack of 4)", "sku": "FMC-015", "category": "Personal Care", "quantity": 220, "unitCost": 90, "sellPrice": 140, "reorderPoint": 35, "location": "Main Warehouse"},
        {"name": "Anti-Dandruff Shampoo 340ml", "sku": "FMC-016", "category": "Personal Care", "quantity": 110, "unitCost": 160, "sellPrice": 245, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Herbal Toothpaste 200g Twin Pack", "sku": "FMC-017", "category": "Personal Care", "quantity": 160, "unitCost": 80, "sellPrice": 130, "reorderPoint": 25, "location": "Main Warehouse"},
        {"name": "Detergent Washing Powder 2kg", "sku": "FMC-018", "category": "Household", "quantity": 130, "unitCost": 180, "sellPrice": 270, "reorderPoint": 25, "location": "Main Warehouse"},
        {"name": "Dishwash Liquid Gel 500ml Bottle", "sku": "FMC-019", "category": "Household", "quantity": 170, "unitCost": 65, "sellPrice": 110, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Surface Floor Cleaner Citrus 1L", "sku": "FMC-020", "category": "Household", "quantity": 140, "unitCost": 95, "sellPrice": 155, "reorderPoint": 25, "location": "Main Warehouse"},
        {"name": "Multi-Purpose Tissue Paper Rolls (Pack of 4)", "sku": "FMC-021", "category": "Household", "quantity": 190, "unitCost": 75, "sellPrice": 125, "reorderPoint": 35, "location": "Store Front"},
        {"name": "Roasted Salted Cashew Nuts 250g", "sku": "FMC-022", "category": "Dry Fruits", "quantity": 85, "unitCost": 220, "sellPrice": 340, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "California Walnuts Kernels 250g", "sku": "FMC-023", "category": "Dry Fruits", "quantity": 70, "unitCost": 260, "sellPrice": 390, "reorderPoint": 12, "location": "Store Front"},
        {"name": "Whole Spices Garam Masala 100g", "sku": "FMC-024", "category": "Spices", "quantity": 210, "unitCost": 45, "sellPrice": 75, "reorderPoint": 40, "location": "Main Warehouse"},
        {"name": "Organic Red Chilli Powder 200g", "sku": "FMC-025", "category": "Spices", "quantity": 230, "unitCost": 40, "sellPrice": 68, "reorderPoint": 40, "location": "Store Front"},
        {"name": "Coriander Powder Dhania 200g", "sku": "FMC-026", "category": "Spices", "quantity": 200, "unitCost": 35, "sellPrice": 58, "reorderPoint": 35, "location": "Main Warehouse"},
        {"name": "Cumin Seeds Jeera 200g", "sku": "FMC-027", "category": "Spices", "quantity": 180, "unitCost": 60, "sellPrice": 95, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Whole Moong Dal Split 1kg", "sku": "FMC-028", "category": "Pulses", "quantity": 120, "unitCost": 90, "sellPrice": 135, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Kala Chana Black Chickpeas 1kg", "sku": "FMC-029", "category": "Pulses", "quantity": 110, "unitCost": 75, "sellPrice": 115, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Pure Jaggery Powder 500g", "sku": "FMC-030", "category": "Staples", "quantity": 150, "unitCost": 40, "sellPrice": 65, "reorderPoint": 25, "location": "Main Warehouse"}
    ],
    "Manufacturing": [
        {"name": "Aluminum Alloy Sheet 2mm (4x8 ft)", "sku": "MFG-001", "category": "Raw Metals", "quantity": 40, "unitCost": 2200, "sellPrice": 3800, "reorderPoint": 8, "location": "Raw Material Yard"},
        {"name": "Cold Rolled Steel Coil 1.5mm", "sku": "MFG-002", "category": "Raw Metals", "quantity": 25, "unitCost": 4500, "sellPrice": 7200, "reorderPoint": 5, "location": "Raw Material Yard"},
        {"name": "Stainless Steel Round Rod 25mm Dia", "sku": "MFG-003", "category": "Raw Metals", "quantity": 60, "unitCost": 850, "sellPrice": 1499, "reorderPoint": 12, "location": "Raw Material Yard"},
        {"name": "Brass Round Bar 12mm Dia (3m)", "sku": "MFG-004", "category": "Raw Metals", "quantity": 50, "unitCost": 1100, "sellPrice": 1899, "reorderPoint": 10, "location": "Raw Material Yard"},
        {"name": "High-Density Polyethylene (HDPE) Granules 25kg", "sku": "MFG-005", "category": "Polymers", "quantity": 100, "unitCost": 1800, "sellPrice": 2799, "reorderPoint": 20, "location": "Main Warehouse"},
        {"name": "Polypropylene Resin Pellets 25kg Bag", "sku": "MFG-006", "category": "Polymers", "quantity": 120, "unitCost": 1600, "sellPrice": 2499, "reorderPoint": 25, "location": "Main Warehouse"},
        {"name": "Industrial NBR Rubber Gasket Sheet 3mm", "sku": "MFG-007", "category": "Seals & Gaskets", "quantity": 75, "unitCost": 350, "sellPrice": 699, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Carbon Steel Seamless Pipe 2-inch", "sku": "MFG-008", "category": "Pipes & Fittings", "quantity": 45, "unitCost": 920, "sellPrice": 1600, "reorderPoint": 10, "location": "Raw Material Yard"},
        {"name": "Heavy Machine Lubricant Oil 20L Drum", "sku": "MFG-009", "category": "Consumables", "quantity": 30, "unitCost": 2800, "sellPrice": 4200, "reorderPoint": 6, "location": "Chemical Store"},
        {"name": "Hydraulic Fluid ISO VG 68 20L", "sku": "MFG-010", "category": "Consumables", "quantity": 28, "unitCost": 3100, "sellPrice": 4600, "reorderPoint": 5, "location": "Chemical Store"},
        {"name": "Hex Flange Bolts M8x30 (Box of 200)", "sku": "MFG-011", "category": "Fasteners", "quantity": 150, "unitCost": 280, "sellPrice": 550, "reorderPoint": 30, "location": "Hardware Bin A"},
        {"name": "Solid Nylon Engineering Rod White 50mm", "sku": "MFG-012", "category": "Plastics", "quantity": 35, "unitCost": 1250, "sellPrice": 2100, "reorderPoint": 7, "location": "Raw Material Yard"},
        {"name": "Enamelled Copper Wire Spool 1.5 sq mm", "sku": "MFG-013", "category": "Electrical Raw", "quantity": 80, "unitCost": 650, "sellPrice": 1150, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Arc Welding Electrodes E6013 3.2mm (5kg)", "sku": "MFG-014", "category": "Consumables", "quantity": 60, "unitCost": 420, "sellPrice": 750, "reorderPoint": 12, "location": "Main Warehouse"},
        {"name": "Industrial Metal Surface Primer Paint 1L", "sku": "MFG-015", "category": "Chemicals", "quantity": 90, "unitCost": 240, "sellPrice": 450, "reorderPoint": 18, "location": "Chemical Store"},
        {"name": "Deep Groove Ball Bearing 6205-2RS", "sku": "MFG-016", "category": "Components", "quantity": 110, "unitCost": 140, "sellPrice": 290, "reorderPoint": 25, "location": "Hardware Bin B"},
        {"name": "High-Temp Silicone Sealant Clear 300ml", "sku": "MFG-017", "category": "Adhesives", "quantity": 130, "unitCost": 180, "sellPrice": 350, "reorderPoint": 25, "location": "Chemical Store"},
        {"name": "Zirconia Sanding Belt 80 Grit (Pack of 5)", "sku": "MFG-018", "category": "Abrasives", "quantity": 85, "unitCost": 220, "sellPrice": 480, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Metal Cutting Disc 4-inch (Pack of 25)", "sku": "MFG-019", "category": "Abrasives", "quantity": 70, "unitCost": 350, "sellPrice": 699, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Medium Strength Threadlocker Blue 50ml", "sku": "MFG-020", "category": "Adhesives", "quantity": 65, "unitCost": 380, "sellPrice": 750, "reorderPoint": 12, "location": "Chemical Store"},
        {"name": "Pneumatic Reinforced Air Hose 10m", "sku": "MFG-021", "category": "Pneumatics", "quantity": 40, "unitCost": 450, "sellPrice": 899, "reorderPoint": 8, "location": "Main Warehouse"},
        {"name": "Directional Control Solenoid Valve 24V DC", "sku": "MFG-022", "category": "Automation", "quantity": 25, "unitCost": 1150, "sellPrice": 2200, "reorderPoint": 5, "location": "Electronics Bin C"},
        {"name": "Induction Hardened Linear Motion Shaft 20mm", "sku": "MFG-023", "category": "Automation", "quantity": 30, "unitCost": 780, "sellPrice": 1499, "reorderPoint": 6, "location": "Raw Material Yard"},
        {"name": "Inductive Proximity Sensor Switch NPN", "sku": "MFG-024", "category": "Sensors", "quantity": 50, "unitCost": 320, "sellPrice": 650, "reorderPoint": 10, "location": "Electronics Bin C"},
        {"name": "High Torque Stepper Motor NEMA 23", "sku": "MFG-025", "category": "Motors", "quantity": 20, "unitCost": 1450, "sellPrice": 2699, "reorderPoint": 4, "location": "Electronics Bin C"},
        {"name": "Heavy Duty Industrial Cooling Fan 120mm", "sku": "MFG-026", "category": "Electrical", "quantity": 60, "unitCost": 280, "sellPrice": 599, "reorderPoint": 12, "location": "Main Warehouse"},
        {"name": "High Thermal Conductivity Grease 100g", "sku": "MFG-027", "category": "Chemicals", "quantity": 45, "unitCost": 190, "sellPrice": 420, "reorderPoint": 8, "location": "Chemical Store"},
        {"name": "Woven Stainless Steel Wire Mesh 40 Mesh", "sku": "MFG-028", "category": "Filters & Mesh", "quantity": 35, "unitCost": 620, "sellPrice": 1200, "reorderPoint": 7, "location": "Main Warehouse"},
        {"name": "Polyurethane Swivel Caster Wheel 4-inch", "sku": "MFG-029", "category": "Hardware", "quantity": 80, "unitCost": 180, "sellPrice": 399, "reorderPoint": 15, "location": "Hardware Bin A"},
        {"name": "Cast Iron Base Plate 10mm Machined", "sku": "MFG-030", "category": "Raw Metals", "quantity": 22, "unitCost": 1600, "sellPrice": 2800, "reorderPoint": 4, "location": "Raw Material Yard"}
    ],
    "General Retail": [
        {"name": "Matte Finish Ceramic Coffee Mug 350ml", "sku": "GEN-001", "category": "Home & Kitchen", "quantity": 120, "unitCost": 85, "sellPrice": 249, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Insulated Stainless Steel Water Bottle 1L", "sku": "GEN-002", "category": "Home & Kitchen", "quantity": 90, "unitCost": 280, "sellPrice": 699, "reorderPoint": 18, "location": "Store Front"},
        {"name": "Desktop Mesh Office Desk Organizer", "sku": "GEN-003", "category": "Stationery", "quantity": 70, "unitCost": 190, "sellPrice": 499, "reorderPoint": 15, "location": "Main Warehouse"},
        {"name": "Adjustable LED Eye-Care Desk Lamp", "sku": "GEN-004", "category": "Electronics", "quantity": 45, "unitCost": 450, "sellPrice": 999, "reorderPoint": 10, "location": "Store Front"},
        {"name": "A5 Hardcover Executive Notebook", "sku": "GEN-005", "category": "Stationery", "quantity": 160, "unitCost": 90, "sellPrice": 249, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Gel Ink Ballpoint Pens Black (Pack of 10)", "sku": "GEN-006", "category": "Stationery", "quantity": 220, "unitCost": 60, "sellPrice": 149, "reorderPoint": 40, "location": "Store Front"},
        {"name": "Wireless Presenter Pointer Remote", "sku": "GEN-007", "category": "Electronics", "quantity": 30, "unitCost": 350, "sellPrice": 899, "reorderPoint": 6, "location": "Main Warehouse"},
        {"name": "Bluetooth Smart Key Finder Tracker", "sku": "GEN-008", "category": "Gadgets", "quantity": 55, "unitCost": 380, "sellPrice": 899, "reorderPoint": 12, "location": "Store Front"},
        {"name": "Microfiber Cleaning Towels (Pack of 4)", "sku": "GEN-009", "category": "Cleaning", "quantity": 180, "unitCost": 75, "sellPrice": 199, "reorderPoint": 35, "location": "Main Warehouse"},
        {"name": "Silent Quartz Wall Clock 12-inch", "sku": "GEN-010", "category": "Home Decor", "quantity": 40, "unitCost": 220, "sellPrice": 599, "reorderPoint": 8, "location": "Store Front"},
        {"name": "Reusable Heavy-Duty Cotton Tote Bag", "sku": "GEN-011", "category": "Lifestyle", "quantity": 140, "unitCost": 65, "sellPrice": 179, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Multi-Purpose Stainless Steel Scissors 8-inch", "sku": "GEN-012", "category": "Stationery", "quantity": 110, "unitCost": 45, "sellPrice": 129, "reorderPoint": 20, "location": "Store Front"},
        {"name": "Self-Adhesive Sticky Notes Pads Assorted", "sku": "GEN-013", "category": "Stationery", "quantity": 250, "unitCost": 30, "sellPrice": 79, "reorderPoint": 50, "location": "Store Front"},
        {"name": "Foldable Fabric Closet Storage Bin", "sku": "GEN-014", "category": "Home Organization", "quantity": 65, "unitCost": 160, "sellPrice": 399, "reorderPoint": 12, "location": "Main Warehouse"},
        {"name": "Waterproof PU Leather Desk Mat", "sku": "GEN-015", "category": "Office", "quantity": 50, "unitCost": 240, "sellPrice": 599, "reorderPoint": 10, "location": "Store Front"},
        {"name": "Windproof Automatic Travel Umbrella", "sku": "GEN-016", "category": "Lifestyle", "quantity": 75, "unitCost": 210, "sellPrice": 499, "reorderPoint": 15, "location": "Store Front"},
        {"name": "Leakproof Bento Lunch Box 3-Grid", "sku": "GEN-017", "category": "Home & Kitchen", "quantity": 80, "unitCost": 180, "sellPrice": 449, "reorderPoint": 15, "location": "Store Front"},
        {"name": "Heavy Metal Non-Skid Bookends (Pair)", "sku": "GEN-018", "category": "Office", "quantity": 35, "unitCost": 140, "sellPrice": 349, "reorderPoint": 7, "location": "Main Warehouse"},
        {"name": "Metallic Mechanical Pencils 0.7mm Set", "sku": "GEN-019", "category": "Stationery", "quantity": 130, "unitCost": 50, "sellPrice": 129, "reorderPoint": 25, "location": "Store Front"},
        {"name": "Expanding File Folder Organizer 13-Pocket", "sku": "GEN-020", "category": "Stationery", "quantity": 60, "unitCost": 130, "sellPrice": 329, "reorderPoint": 12, "location": "Main Warehouse"},
        {"name": "Tabletop Digital Alarm Clock & Temperature", "sku": "GEN-021", "category": "Electronics", "quantity": 55, "unitCost": 190, "sellPrice": 499, "reorderPoint": 10, "location": "Store Front"},
        {"name": "Handmade Leather Keychain Ring Holder", "sku": "GEN-022", "category": "Lifestyle", "quantity": 150, "unitCost": 40, "sellPrice": 149, "reorderPoint": 30, "location": "Store Front"},
        {"name": "Neoprene Water Bottle Sleeve Carrier", "sku": "GEN-023", "category": "Lifestyle", "quantity": 95, "unitCost": 45, "sellPrice": 129, "reorderPoint": 18, "location": "Store Front"},
        {"name": "Silicone Cable Management Clips (10 Pack)", "sku": "GEN-024", "category": "Gadgets", "quantity": 200, "unitCost": 35, "sellPrice": 99, "reorderPoint": 40, "location": "Store Front"},
        {"name": "Vacuum Stainless Flask 500ml", "sku": "GEN-025", "category": "Home & Kitchen", "quantity": 70, "unitCost": 220, "sellPrice": 549, "reorderPoint": 14, "location": "Main Warehouse"},
        {"name": "Stainless Steel Pocket Multi-Tool", "sku": "GEN-026", "category": "Gadgets", "quantity": 40, "unitCost": 210, "sellPrice": 499, "reorderPoint": 8, "location": "Store Front"},
        {"name": "Flexible Neoprene Cable Management Sleeve 1.5m", "sku": "GEN-027", "category": "Office", "quantity": 65, "unitCost": 80, "sellPrice": 199, "reorderPoint": 12, "location": "Main Warehouse"},
        {"name": "Magnetic Leather Bookmark Set (Pack of 3)", "sku": "GEN-028", "category": "Stationery", "quantity": 170, "unitCost": 35, "sellPrice": 99, "reorderPoint": 35, "location": "Store Front"},
        {"name": "Foldable Universal Smartphone Stand", "sku": "GEN-029", "category": "Gadgets", "quantity": 180, "unitCost": 40, "sellPrice": 119, "reorderPoint": 35, "location": "Store Front"},
        {"name": "Multi-Purpose Acrylic Storage Organizer Box", "sku": "GEN-030", "category": "Home Organization", "quantity": 50, "unitCost": 150, "sellPrice": 379, "reorderPoint": 10, "location": "Main Warehouse"}
    ]
}

_DEFAULT_CATALOG = _FALLBACK_CATALOGS["Food & Restaurant"]


def _get_industry_fallback(industry_name: str):
    if not industry_name:
        return _FALLBACK_CATALOGS["General Retail"]

    ind_lower = industry_name.lower()

    for key, items in _FALLBACK_CATALOGS.items():
        if key.lower() in ind_lower or ind_lower in key.lower():
            return items

    if "electronic" in ind_lower:
        return _FALLBACK_CATALOGS["Electronics & Gadgets"]
    if "food" in ind_lower or "restaurant" in ind_lower:
        return _FALLBACK_CATALOGS["Food & Restaurant"]
    if "pharm" in ind_lower or "health" in ind_lower:
        return _FALLBACK_CATALOGS["Pharmacy & Healthcare"]
    if "apparel" in ind_lower or "fashion" in ind_lower:
        return _FALLBACK_CATALOGS["Apparel & Fashion"]
    if "hardw" in ind_lower or "tool" in ind_lower:
        return _FALLBACK_CATALOGS["Hardware & Industrial"]
    if "fmcg" in ind_lower or "groc" in ind_lower:
        return _FALLBACK_CATALOGS["FMCG & Grocery"]
    if "manuf" in ind_lower or "factory" in ind_lower:
        return _FALLBACK_CATALOGS["Manufacturing"]

    return _FALLBACK_CATALOGS["General Retail"]


@app.route("/api/ai/onboard-catalog", methods=["POST"])
def ai_onboard_catalog():
    """Generate a starter inventory catalog for a new business based on industry type."""
    body = request.get_json(force=True) or {}
    industry = body.get("industry", "General Retail")
    company_name = body.get("companyName", "My Business")

    system = """You are StockShiftAI, an expert inventory setup assistant.
Generate a realistic starter catalog of EXACTLY 30 real, authentic inventory products for a business.
DO NOT use placeholder names like "Product A", "Compact item", or generic placeholders.
For Food & Restaurant: Include real raw dairy products (Milk, Paneer, Butter, Ghee, Curd, Cream, Cheese), grains, pulses, spices.
For Electronics: Include real specific gadget names (Headphones, Chargers, Keyboards, Monitors, Powerbanks, Cables, SSDs, Mice, Webcams).
For Pharmacy: Include real medicines (Paracetamol, Thermometer, BP Monitor, Antibacterial, Bandages, Vitamin C).
For Apparel: Include real clothing (Jeans, Shirts, T-Shirts, Hoodies, Shoes, Belts, Jackets).
For Hardware: Include real tools (Drill, Screws, Pliers, Wrench, Safety Helmet, Angle Grinder).
For Manufacturing: Include real raw materials (Aluminum Sheet, Steel Rod, HDPE Granules, Bolts, Lubricants).
CRITICAL SKU RULE: SKU codes MUST be derived from the product sector/category prefix (e.g. for Raw Dairy use "DRY-001", for Grains & Rice use "GRN-001", for Flour & Staples use "STP-001", for Oils use "OIL-001", for Pulses use "PLS-001", for Spices use "SPC-001", for Beverages use "BEV-001", for Condiments use "CND-001", for Dry Fruits use "DFT-001") and NOT from the individual product name.
Each product MUST have realistic names, category, unitCost in INR ₹, sellPrice in INR ₹, quantity (30-300), reorderPoint (10-50), location, and sector-based SKU.

Return ONLY valid JSON in this exact structure:
{"items": [{"name": "Specific Real Product Name", "sku": "DRY-001", "category": "Raw Dairy", "quantity": 100, "unitCost": 52, "sellPrice": 66, "reorderPoint": 50, "location": "Cold Storage A"}]}
Do NOT include markdown fences, code blocks, or explanatory text."""

    user_prompt = f"Generate 30 highly specific, authentic real products for Company: '{company_name}', Industry: '{industry}'."

    raw = call_llm(system, user_prompt, max_tokens=4000)

    if raw:
        parsed = _extract_json(raw)
        if parsed and "items" in parsed and isinstance(parsed["items"], list) and len(parsed["items"]) >= 10:
            return jsonify(parsed)

        # Try parsing array directly
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                parts = cleaned.split("\n", 1)
                if len(parts) > 1:
                    cleaned = parts[1]
                if cleaned.endswith("```"):
                    cleaned = cleaned.rsplit("```", 1)[0]
                cleaned = cleaned.strip()
            arr = json.loads(cleaned)
            if isinstance(arr, list) and len(arr) >= 10:
                return jsonify({"items": arr})
        except json.JSONDecodeError:
            pass

    # High-quality fallback catalog matching industry with 30 real items
    fallback = _get_industry_fallback(industry)
    print(f"ℹ️ Returning starter catalog fallback (30 items) for industry: {industry}")
    return jsonify({"items": fallback})


# ── AI Vendor Auto-Extraction ─────────────────────────────────────────────────

@app.route("/api/ai/parse-vendor", methods=["POST"])
def ai_parse_vendor():
    """Extract structured vendor details from raw text (invoice, rate card, website copy)."""
    body = request.get_json(force=True) or {}
    raw_text = body.get("text", "")

    if not raw_text.strip():
        return jsonify({"error": "No text provided"}), 400

    system = """You are StockShiftAI, a vendor data extraction assistant.
Extract structured vendor information from the provided raw text.
Return ONLY a valid JSON object with these keys:
- name (string, company/vendor name)
- contactPerson (string or empty)
- email (string or empty)
- phone (string or empty)
- address (string or empty)
- leadTimeDays (integer, estimate if not stated, default 7)
- minOrderQty (integer, estimate if not stated, default 10)
- paymentTerms (string like "Net 30", "COD", etc.)
- notes (string, any extra details)

If info is missing, use reasonable defaults. Do NOT return markdown or code fences."""

    user_prompt = f"Extract vendor details from this text:\n\n{raw_text[:3000]}"

    raw = call_llm(system, user_prompt)
    if not raw:
        return jsonify({"error": "AI service unavailable"}), 503

    parsed = _extract_json(raw)
    if parsed and "name" in parsed:
        return jsonify({"vendor": parsed})

    return jsonify({"error": "Failed to parse vendor data"}), 500


# ── POS Checkout API (for local store machines) ───────────────────────────────

def _validate_api_key(api_key: str) -> dict | None:
    """Validate an API key against the api_keys table in Supabase. Returns key row or None."""
    if not supabase or not api_key:
        return None
    try:
        res = supabase.table("api_keys").select("*").eq("key", api_key).eq("is_active", True).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        print(f"⚠️ API key validation error: {e}")
    return None


@app.route("/api/v1/pos/checkout", methods=["POST"])
def pos_checkout():
    """Process a POS sale: deduct inventory for each item sold.
    
    Expects:
    - Header: x-api-key OR Authorization: Bearer <key>
    - Body: { "items": [{ "sku": "...", "quantity": 1 }], "userId": "..." }
    
    For web-based POS terminal, userId from auth session is used directly (no api key needed if Supabase auth header present).
    """
    body = request.get_json(force=True) or {}
    sale_items = body.get("items", [])
    user_id = body.get("userId", "")

    if not sale_items:
        return jsonify({"error": "No items in checkout"}), 400

    # Validate: either API key or userId must be present
    api_key = request.headers.get("x-api-key") or ""
    if not api_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            api_key = auth_header[7:]

    # If API key is provided, validate it and extract userId from the key record
    if api_key and not user_id:
        key_record = _validate_api_key(api_key)
        if not key_record:
            return jsonify({"error": "Invalid or revoked API key"}), 401
        user_id = key_record.get("user_id", "")

    if not user_id:
        return jsonify({"error": "User identification required (userId or valid API key)"}), 401

    if not supabase:
        return jsonify({"error": "Database unavailable"}), 503

    results = []
    low_stock_alerts = []

    for sale_item in sale_items:
        sku = sale_item.get("sku", "")
        qty = int(sale_item.get("quantity", 1))

        if not sku or qty <= 0:
            results.append({"sku": sku, "status": "error", "message": "Invalid SKU or quantity"})
            continue

        try:
            # Find the inventory item
            res = supabase.table("inventory_items").select("*").eq("user_id", user_id).eq("sku", sku).execute()

            if not res.data or len(res.data) == 0:
                results.append({"sku": sku, "status": "error", "message": f"Item with SKU {sku} not found"})
                continue

            item = res.data[0]
            current_qty = int(item.get("quantity", 0))
            new_qty = max(0, current_qty - qty)

            # Update quantity
            supabase.table("inventory_items").update({
                "quantity": new_qty,
                "updated_at": datetime.now().isoformat()
            }).eq("id", item["id"]).execute()

            # Log transaction
            supabase.table("transactions").insert({
                "user_id": user_id,
                "item_id": item["id"],
                "item_name": item.get("name", sku),
                "type": "out",
                "quantity": qty,
                "performed_by": "POS Terminal",
                "notes": f"POS sale: {qty} units of {sku}"
            }).execute()

            item_result = {
                "sku": sku,
                "name": item.get("name", ""),
                "status": "sold",
                "quantitySold": qty,
                "remainingStock": new_qty
            }
            results.append(item_result)

            # Check for low stock alert
            reorder_point = int(item.get("reorder_point", 0))
            if new_qty <= reorder_point:
                low_stock_alerts.append({
                    "sku": sku,
                    "name": item.get("name", ""),
                    "remainingStock": new_qty,
                    "reorderPoint": reorder_point
                })

        except Exception as e:
            results.append({"sku": sku, "status": "error", "message": str(e)})

    # Bust relevant caches since inventory changed
    cache_bust("insights")
    cache_bust("anomalies")

    return jsonify({
        "success": True,
        "results": results,
        "lowStockAlerts": low_stock_alerts,
        "processedAt": datetime.now().isoformat()
    })


# ── API Key Management ────────────────────────────────────────────────────────

@app.route("/api/v1/api-keys", methods=["POST"])
def create_api_key():
    """Generate a new API key for a user."""
    body = request.get_json(force=True) or {}
    user_id = body.get("userId", "")
    label = body.get("label", "Default POS Key")

    if not user_id:
        return jsonify({"error": "userId required"}), 400

    if not supabase:
        return jsonify({"error": "Database unavailable"}), 503

    import secrets
    api_key = f"sk-pos-{secrets.token_hex(24)}"

    try:
        supabase.table("api_keys").insert({
            "user_id": user_id,
            "key": api_key,
            "label": label,
            "is_active": True
        }).execute()

        return jsonify({"key": api_key, "label": label})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/api-keys/<user_id>", methods=["GET"])
def list_api_keys(user_id: str):
    """List all API keys for a user."""
    if not supabase:
        return jsonify({"error": "Database unavailable"}), 503

    try:
        res = supabase.table("api_keys").select("id, key, label, is_active, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        return jsonify({"keys": res.data or []})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/api-keys/<key_id>/revoke", methods=["POST"])
def revoke_api_key(key_id: str):
    """Revoke an API key."""
    if not supabase:
        return jsonify({"error": "Database unavailable"}), 503

    try:
        supabase.table("api_keys").update({"is_active": False}).eq("id", key_id).execute()
        return jsonify({"status": "revoked"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cache/clear", methods=["POST"])
def clear_cache():
    """Bust all cached responses so next request fetches fresh AI data."""
    with _cache_lock:
        _cache.clear()
    return jsonify({"status": "cleared"})


# ── Cache warmup on startup ───────────────────────────────────────────────────

def _warmup_cache():
    """Pre-fetch AI data into cache on server start so first page load is fast."""
    import threading
    import urllib.request

    def _run():
        import time as _t
        _t.sleep(4)  # Wait for Flask to finish binding
        port = int(os.getenv("PORT", 5001))
        base = f"http://127.0.0.1:{port}"
        endpoints = ["/api/insights", "/api/anomalies", "/api/cost-optimization", "/api/warehouse-optimization"]
        for ep in endpoints:
            try:
                urllib.request.urlopen(f"{base}{ep}?refresh=0", timeout=30)
                print(f"✅ Warmed cache: {ep}")
            except Exception as e:
                print(f"⚠️  Cache warmup failed for {ep}: {e}")

    t = threading.Thread(target=_run, daemon=True)
    t.start()


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    _warmup_cache()
    app.run(host="0.0.0.0", port=port, debug=True)
