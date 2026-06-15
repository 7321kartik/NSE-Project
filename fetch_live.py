"""
fetch_live.py — Fetches live intraday data from NSE using nselib.
Collects: top gainers, top losers, most active stocks, all indices.
Saves results to public/live_data.json.
Takes ~5-8 seconds to run.
"""
import os
import json
from datetime import datetime
from nselib import capital_market

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'live_data.json')

def safe_float(val):
    try:
        return round(float(val), 2) if val not in (None, '', 'nan', '-') else None
    except (TypeError, ValueError):
        return None

def safe_int(val):
    try:
        return int(float(val)) if val not in (None, '', '-') else 0
    except (TypeError, ValueError):
        return 0

def fetch_gainers_losers():
    """Fetches top 20 gainers and 20 losers from NSE."""
    gainers, losers = [], []
    try:
        df_g = capital_market.top_gainers_or_losers(to_get='gainers')
        for _, row in df_g.iterrows():
            gainers.append({
                'symbol':    str(row.get('symbol', '')),
                'ltp':       safe_float(row.get('ltp')),
                'pChange':   safe_float(row.get('perChange')),
                'change':    safe_float(row.get('net_price')),
                'prevClose': safe_float(row.get('prev_price')),
                'open':      safe_float(row.get('open_price')),
                'dayHigh':   safe_float(row.get('high_price')),
                'dayLow':    safe_float(row.get('low_price')),
                'volume':    safe_int(row.get('trade_quantity')),
                'turnover':  safe_float(row.get('turnover')),
            })
        print(f"  Gainers: {len(gainers)} stocks")
    except Exception as e:
        print(f"  Gainers fetch failed: {e}")

    try:
        df_l = capital_market.top_gainers_or_losers(to_get='loosers')
        for _, row in df_l.iterrows():
            losers.append({
                'symbol':    str(row.get('symbol', '')),
                'ltp':       safe_float(row.get('ltp')),
                'pChange':   safe_float(row.get('perChange')),
                'change':    safe_float(row.get('net_price')),
                'prevClose': safe_float(row.get('prev_price')),
                'open':      safe_float(row.get('open_price')),
                'dayHigh':   safe_float(row.get('high_price')),
                'dayLow':    safe_float(row.get('low_price')),
                'volume':    safe_int(row.get('trade_quantity')),
                'turnover':  safe_float(row.get('turnover')),
            })
        print(f"  Losers: {len(losers)} stocks")
    except Exception as e:
        print(f"  Losers fetch failed: {e}")

    return gainers, losers

def fetch_most_active():
    """Fetches top 20 most actively traded stocks by value."""
    active = []
    try:
        df = capital_market.most_active_equities()
        for _, row in df.iterrows():
            active.append({
                'symbol':    str(row.get('symbol', '')),
                'ltp':       safe_float(row.get('lastPrice')),
                'pChange':   safe_float(row.get('pChange')),
                'change':    safe_float(row.get('change')),
                'prevClose': safe_float(row.get('previousClose')),
                'open':      safe_float(row.get('open')),
                'dayHigh':   safe_float(row.get('dayHigh')),
                'dayLow':    safe_float(row.get('dayLow')),
                'volume':    safe_int(row.get('totalTradedVolume')),
                'turnover':  safe_float(row.get('totalTradedValue')),
                'yearHigh':  safe_float(row.get('yearHigh')),
                'yearLow':   safe_float(row.get('yearLow')),
                'lastUpdate': str(row.get('lastUpdateTime', '')),
            })
        print(f"  Most active: {len(active)} stocks")
    except Exception as e:
        print(f"  Most active fetch failed: {e}")
    return active

def fetch_indices():
    """Fetches live data for all NSE indices."""
    indices = []
    try:
        df = capital_market.market_watch_all_indices()
        for _, row in df.iterrows():
            indices.append({
                'name':       str(row.get('index', '')),
                'symbol':     str(row.get('indexSymbol', '')),
                'last':       safe_float(row.get('last')),
                'pChange':    safe_float(row.get('percentChange')),
                'change':     safe_float(row.get('variation')),
                'open':       safe_float(row.get('open')),
                'high':       safe_float(row.get('high')),
                'low':        safe_float(row.get('low')),
                'prevClose':  safe_float(row.get('previousClose')),
                'yearHigh':   safe_float(row.get('yearHigh')),
                'yearLow':    safe_float(row.get('yearLow')),
                'advances':   safe_int(row.get('advances')),
                'declines':   safe_int(row.get('declines')),
                'unchanged':  safe_int(row.get('unchanged')),
                'pe':         safe_float(row.get('pe')),
            })
        print(f"  Indices: {len(indices)}")
    except Exception as e:
        print(f"  Indices fetch failed: {e}")
    return indices

def run():
    print(f"[fetch_live] Starting at {datetime.now().strftime('%H:%M:%S')} IST")

    gainers, losers = fetch_gainers_losers()
    active = fetch_most_active()
    indices = fetch_indices()

    # Build a merged stocks dict keyed by symbol (for quick lookup from screener)
    all_stocks = {}
    
    # Filter out ETFs, Gilt/Gold Bonds, and mutual fund instruments
    def is_etf(sym):
        sym = str(sym).upper()
        # Keywords representing ETFs / Mutual Funds / G-Secs
        keywords = ('ETF', 'BEES', 'BETF', 'LIQUID', 'GSEC', 'GILT')
        if any(kw in sym for kw in keywords):
            return True
        if sym.startswith('SETF') or sym in ('M50', 'MON100'):
            return True
        return False

    for stock in gainers + losers + active:
        sym = stock.get('symbol', '')
        if sym and sym not in all_stocks:
            if not is_etf(sym):
                all_stocks[sym] = stock

    output = {
        'timestamp':   datetime.now().isoformat(),
        'fetchedAt':   datetime.now().strftime('%d-%b-%Y %H:%M:%S IST'),
        'totalStocks': len(all_stocks),
        'gainers':     gainers,
        'losers':      losers,
        'mostActive':  active,
        'indices':     indices,
        'stocks':      all_stocks,  # Merged dict for per-symbol lookup
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"[fetch_live] SUCCESS: saved to {OUTPUT_FILE}")
    print(f"  Gainers: {len(gainers)}, Losers: {len(losers)}, Active: {len(active)}, Indices: {len(indices)}")
    return True

if __name__ == '__main__':
    run()
