import os
import re
import sys
import json
import requests
import subprocess
import threading
from datetime import datetime
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

# In-memory flags to track background refresh execution status
is_refreshing = False
refresh_error = None
last_refresh_time = None
refresh_started_at = None  # Track when the current refresh started

REFRESH_TIMEOUT_MINUTES = 15  # Auto-reset if scraper runs longer than this

def dashboard(request):
    """Serves the main frontend dashboard page."""
    return render(request, 'screener/index.html')

def get_market_data(request):
    """Serves the aggregated market data from market_data.json."""
    data_path = os.path.join(settings.BASE_DIR, 'public', 'market_data.json')
    if not os.path.exists(data_path):
        return JsonResponse({"error": "Market data file not found. Please refresh data."}, status=404)
    
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": f"Failed to read market data from server cache: {str(e)}..."}, status=500)

@csrf_exempt
def refresh_data(request):
    """Triggers background data scraping by running fetch_data.py."""
    global is_refreshing, refresh_error, refresh_started_at
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)

    # Auto-reset if a previous scrape has exceeded the safety timeout
    if is_refreshing and refresh_started_at:
        elapsed = (datetime.now() - refresh_started_at).total_seconds() / 60
        if elapsed >= REFRESH_TIMEOUT_MINUTES:
            print(f"Safety timeout: resetting is_refreshing after {elapsed:.1f} minutes")
            is_refreshing = False
            refresh_error = f"Previous refresh timed out after {elapsed:.1f} minutes"

    if is_refreshing:
        elapsed_mins = 0
        if refresh_started_at:
            elapsed_mins = (datetime.now() - refresh_started_at).total_seconds() / 60
        return JsonResponse({
            "status": "refreshing",
            "message": f"A data refresh is already in progress ({elapsed_mins:.1f} min elapsed)."
        }, status=400)
    
    is_refreshing = True
    refresh_error = None
    refresh_started_at = datetime.now()
    
    print("Starting background update of market data via fetch_data.py...")
    
    def run_scraper():
        global is_refreshing, refresh_error, last_refresh_time, refresh_started_at
        try:
            script_path = os.path.join(settings.BASE_DIR, 'fetch_data.py')
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True, text=True, check=True,
                cwd=settings.BASE_DIR
            )
            last_refresh_time = datetime.now().isoformat()
            print("Python script finished successfully:\n", result.stdout)
        except subprocess.CalledProcessError as e:
            print("Python script failed with code", e.returncode)
            print("Error details:\n", e.stderr)
            refresh_error = e.stderr or e.output or f"CalledProcessError code {e.returncode}"
        except Exception as e:
            print("Python script failed with unexpected error:", str(e))
            refresh_error = str(e)
        finally:
            is_refreshing = False
            refresh_started_at = None

    threading.Thread(target=run_scraper, daemon=True).start()
    return JsonResponse({"status": "started", "message": "Data refresh started in background."})

def refresh_status(request):
    """Checks the current status of background refreshing."""
    elapsed_mins = 0
    if is_refreshing and refresh_started_at:
        elapsed_mins = round((datetime.now() - refresh_started_at).total_seconds() / 60, 1)
    return JsonResponse({
        "refreshing": is_refreshing,
        "error": refresh_error,
        "lastRefreshTime": last_refresh_time,
        "elapsedMinutes": elapsed_mins
    })

@csrf_exempt
def refresh_reset(request):
    """Emergency endpoint to manually reset the is_refreshing flag."""
    global is_refreshing, refresh_error, refresh_started_at
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)
    is_refreshing = False
    refresh_error = None
    refresh_started_at = None
    print("Refresh state manually reset via /api/refresh-reset")
    return JsonResponse({"status": "reset", "message": "Refresh state has been reset."})

# ─── Live Data Endpoints ─────────────────────────────────────────────────────

is_live_refreshing = False
live_refresh_error = None
live_refresh_started_at = None

def get_live_data(request):
    """Serves live market data from live_data.json."""
    data_path = os.path.join(settings.BASE_DIR, 'public', 'live_data.json')
    if not os.path.exists(data_path):
        return JsonResponse({"error": "Live data not available. Click 'Live' to fetch."}, status=404)
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def live_refresh(request):
    """Triggers a background live data fetch via fetch_live.py."""
    global is_live_refreshing, live_refresh_error, live_refresh_started_at
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if is_live_refreshing and live_refresh_started_at:
        elapsed = (datetime.now() - live_refresh_started_at).total_seconds() / 60
        if elapsed >= 5:
            is_live_refreshing = False
    if is_live_refreshing:
        return JsonResponse({"status": "refreshing"}, status=400)
    is_live_refreshing = True
    live_refresh_error = None
    live_refresh_started_at = datetime.now()

    def run_live_scraper():
        global is_live_refreshing, live_refresh_error, live_refresh_started_at
        try:
            script_path = os.path.join(settings.BASE_DIR, 'fetch_live.py')
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True, text=True, check=True,
                cwd=settings.BASE_DIR
            )
            print("Live fetch finished:\n", result.stdout)
        except subprocess.CalledProcessError as e:
            live_refresh_error = e.stderr or str(e)
        except Exception as e:
            live_refresh_error = str(e)
        finally:
            is_live_refreshing = False
            live_refresh_started_at = None

    threading.Thread(target=run_live_scraper, daemon=True).start()
    return JsonResponse({"status": "started"})

def live_status(request):
    """Returns the current status of the live data refresh."""
    return JsonResponse({"refreshing": is_live_refreshing, "error": live_refresh_error})

def chart_proxy(request, symbol):
    """Proxies OHLCV data from Yahoo Finance for any NSE stock."""
    symbol = symbol.upper()
    # Clean the symbol
    symbol = re.sub(r'[^A-Z0-9&]', '', symbol)
    yahoo_symbol = f"{symbol}.NS"
    range_param = request.GET.get('range', '6mo')
    interval_param = request.GET.get('interval', '1d')

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}?interval={interval_param}&range={range_param}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return JsonResponse({"error": f"No data found for NSE:{symbol}"}, status=404)

        raw_data = resp.json()
        result = raw_data.get('chart', {}).get('result', [])
        if not result:
            return JsonResponse({"error": f"No data found for NSE:{symbol}"}, status=404)

        res_data = result[0]
        timestamps = res_data.get('timestamp', [])
        quote = res_data.get('indicators', {}).get('quote', [{}])[0]

        opens = quote.get('open', [])
        highs = quote.get('high', [])
        lows = quote.get('low', [])
        closes = quote.get('close', [])
        volumes = quote.get('volume', [])

        candles = []
        for i in range(len(timestamps)):
            o = opens[i] if i < len(opens) else None
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            c = closes[i] if i < len(closes) else None
            v = volumes[i] if i < len(volumes) else 0

            # Skip nulls (market holidays)
            if o is None or h is None or l is None or c is None:
                continue

            candles.append({
                "time": int(timestamps[i]),
                "open": round(float(o), 2),
                "high": round(float(h), 2),
                "low": round(float(l), 2),
                "close": round(float(c), 2),
                "volume": int(v) if v else 0
            })

        meta = res_data.get('meta', {})
        return JsonResponse({
            "symbol": symbol,
            "currency": meta.get('currency', 'INR'),
            "exchange": meta.get('exchangeName', 'NSE'),
            "regularMarketPrice": meta.get('regularMarketPrice'),
            "candles": candles
        })
    except Exception as e:
        return JsonResponse({"error": f"Failed to fetch chart data: {str(e)}"}, status=500)

@csrf_exempt
def export_csv(request):
    """Saves CSV data locally to C:\\download on the server machine."""
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        body = json.loads(request.body)
        csv_data = body.get('csvData')
        filename = body.get('filename')
    except Exception:
        return JsonResponse({"error": "Missing or invalid JSON body"}, status=400)

    if not csv_data or not filename:
        return JsonResponse({"error": "Missing csvData or filename in request body."}, status=400)

    if os.name == 'nt':
        download_dir = 'C:\\download'
    else:
        download_dir = os.path.join(settings.BASE_DIR, 'public', 'downloads')
    try:
        if not os.path.exists(download_dir):
            os.makedirs(download_dir, exist_ok=True)
        file_path = os.path.join(download_dir, filename)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(csv_data)
        return JsonResponse({"success": True, "filePath": file_path})
    except Exception as e:
        return JsonResponse({"error": f"Export failed: {str(e)}"}, status=500)
