import os
import sys
import json
from datetime import datetime, timedelta
import pandas as pd
from nselib import capital_market
import requests
import concurrent.futures

def get_latest_n_days_bhav(n=5):
    dfs = []
    dates = []
    current_date = datetime.now()
    days_checked = 0
    max_days = 20
    
    print(f"Starting to fetch last {n} trading days' Bhav Copies...")
    
    while len(dfs) < n and days_checked < max_days:
        # Skip weekends (5 = Saturday, 6 = Sunday)
        if current_date.weekday() >= 5:
            current_date -= timedelta(days=1)
            days_checked += 1
            continue
            
        date_str = current_date.strftime('%d-%m-%Y')
        
        # Skip today if it's a weekday but before 5:30 PM local time when Bhav Copy is generated
        if current_date.date() == datetime.now().date():
            now_time = datetime.now()
            if now_time.hour < 17 or (now_time.hour == 17 and now_time.minute < 30):
                print(f"Skipping today's date ({date_str}) as Bhav Copy is not yet released.")
                current_date -= timedelta(days=1)
                days_checked += 1
                continue

        print(f"Checking date: {date_str}...")
        try:
            df = capital_market.bhav_copy_equities(date_str)
            if df is not None and not df.empty:
                df.columns = [c.strip() for c in df.columns]
                required_cols = {'TckrSymb', 'ClsPric', 'TtlTradgVol', 'SctySrs', 'PrvsClsgPric', 'OpnPric', 'HghPric', 'LwPric'}
                if required_cols.issubset(df.columns):
                    df_eq = df[df['SctySrs'] == 'EQ'].copy()
                    if not df_eq.empty:
                        dfs.append(df_eq)
                        dates.append(date_str)
                        print(f"  -> SUCCESS: {date_str} ({len(df_eq)} EQ rows)")
                    else:
                        print(f"  -> Warning: No EQ series for {date_str}")
                else:
                    missing = required_cols - set(df.columns)
                    print(f"  -> Warning: Missing columns {missing}")
            else:
                print(f"  -> Empty data for {date_str}")
        except Exception as e:
            print(f"  -> No data for {date_str}: {type(e).__name__}")
        
        current_date -= timedelta(days=1)
        days_checked += 1
        
    return dfs, dates

def safe_float(val, default=0.0):
    try:
        f = float(val)
        return f if f == f else default  # NaN check
    except:
        return default

def fetch_historical_yahoo(symbols, workers=40):
    """
    Fetches 1y historical daily data for a list of symbol tickers from Yahoo Finance in parallel.
    Returns a dict mapping symbol -> historical daily bars (dict of close, high, low, open, volume arrays).
    """
    results = {}
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    def fetch_one(symbol):
        # Clean symbol to match Yahoo NS tickers, e.g. replacing special chars
        clean_symbol = symbol.replace('&', '%26')
        yahoo_symbol = f"{clean_symbol}.NS"
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}?interval=1d&range=1y"
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                res = data.get('chart', {}).get('result', [])
                if res:
                    meta = res[0].get('meta', {})
                    quote = res[0].get('indicators', {}).get('quote', [{}])[0]
                    highs = quote.get('high', [])
                    lows = quote.get('low', [])
                    closes = quote.get('close', [])
                    volumes = quote.get('volume', [])
                    
                    cleaned_highs = []
                    cleaned_lows = []
                    cleaned_closes = []
                    cleaned_volumes = []
                    
                    for h, l, c, v in zip(highs, lows, closes, volumes):
                        if h is not None and l is not None and c is not None and v is not None:
                            cleaned_highs.append(h)
                            cleaned_lows.append(l)
                            cleaned_closes.append(c)
                            cleaned_volumes.append(v)
                            
                    return symbol, {
                        'highs': cleaned_highs,
                        'lows': cleaned_lows,
                        'closes': cleaned_closes,
                        'volumes': cleaned_volumes,
                        'fiftyTwoWeekHigh': meta.get('fiftyTwoWeekHigh'),
                        'fiftyTwoWeekLow': meta.get('fiftyTwoWeekLow')
                    }
            return symbol, None
        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {e}")
            return symbol, None

    print(f"Fetching 1y history for {len(symbols)} liquid stocks in parallel...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        for sym, hist in executor.map(fetch_one, symbols):
            if hist:
                results[sym] = hist
                
    return results

def aggregate_data(dfs, dates):
    if not dfs:
        return []
    
    latest_df = dfs[0].copy()
    prior_dfs = dfs[1:]
    
    # Convert numeric fields in all dataframes
    numeric_cols = ['OpnPric', 'HghPric', 'LwPric', 'ClsPric', 'LastPric', 'PrvsClsgPric', 'TtlTradgVol', 'TtlTrfVal']
    for df in dfs:
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
    
    # Build prior-day lookup
    prior_volumes = {}
    prior_turnovers = {}
    prior_closes = {}  # track prior closing prices for trend
    
    for i, df in enumerate(prior_dfs):
        for _, row in df.iterrows():
            sym = row['TckrSymb']
            if sym not in prior_volumes:
                prior_volumes[sym] = []
                prior_turnovers[sym] = []
                prior_closes[sym] = []
            prior_volumes[sym].append(safe_float(row['TtlTradgVol']))
            prior_turnovers[sym].append(safe_float(row['TtlTrfVal']))
            prior_closes[sym].append(safe_float(row['ClsPric']))
    
    results = []
    for _, row in latest_df.iterrows():
        sym = row['TckrSymb']
        close   = safe_float(row['ClsPric'])
        prev_close = safe_float(row['PrvsClsgPric'])
        open_p  = safe_float(row['OpnPric'])
        high_p  = safe_float(row['HghPric'])
        low_p   = safe_float(row['LwPric'])
        today_vol = safe_float(row['TtlTradgVol'])
        today_val = safe_float(row['TtlTrfVal'])
        
        if today_vol == 0 or close == 0:
            continue
        
        # --- Core Metrics ---
        # Price change %
        p_change = ((close - prev_close) / prev_close * 100.0) if prev_close > 0 else 0.0
        
        # Day range % = (High - Low) / Close * 100  — measures intraday volatility
        day_range_pct = ((high_p - low_p) / close * 100.0) if close > 0 else 0.0
        
        # Price vs Day High % = how close LTP is to the high (100% = at high, 0% = at low)
        price_vs_high_pct = ((close - low_p) / (high_p - low_p) * 100.0) if (high_p - low_p) > 0 else 50.0
        
        # Body / Candle Strength % = body size relative to full range (for engulfing patterns)
        body_pct = (abs(close - open_p) / (high_p - low_p) * 100.0) if (high_p - low_p) > 0 else 0.0
        
        # Gap % = Open vs Prev Close
        gap_pct = ((open_p - prev_close) / prev_close * 100.0) if prev_close > 0 else 0.0
        
        # --- Volume Metrics ---
        vols = prior_volumes.get(sym, [])
        vals = prior_turnovers.get(sym, [])
        closes_prior = prior_closes.get(sym, [])
        
        avg_vol = (sum(vols) / len(vols)) if vols else today_vol
        avg_val = (sum(vals) / len(vals)) if vals else today_val
        vol_ratio = (today_vol / avg_vol) if avg_vol > 0 else 1.0
        
        # Average prior close (to determine multi-day trend direction)
        avg_prior_close = (sum(closes_prior) / len(closes_prior)) if closes_prior else prev_close
        multi_day_trend_pct = ((close - avg_prior_close) / avg_prior_close * 100.0) if avg_prior_close > 0 else 0.0
        
        # Turnover in Crores
        turnover_cr = today_val / 10_000_000.0
        avg_turnover_cr = avg_val / 10_000_000.0
        
        results.append({
            "symbol":            sym,
            "ltp":               round(close, 2),
            "prev_close":        round(prev_close, 2),
            "open":              round(open_p, 2),
            "high":              round(high_p, 2),
            "low":               round(low_p, 2),
            "change_pct":        round(p_change, 2),
            "gap_pct":           round(gap_pct, 2),
            "day_range_pct":     round(day_range_pct, 2),
            "price_vs_high_pct": round(price_vs_high_pct, 2),  # 100 = at high, 0 = at low
            "body_pct":          round(body_pct, 2),           # candle body strength
            "volume":            int(today_vol),
            "avg_volume":        int(avg_vol),
            "volume_ratio":      round(vol_ratio, 2),
            "turnover_cr":       round(turnover_cr, 2),
            "avg_turnover_cr":   round(avg_turnover_cr, 2),
            "multi_day_trend_pct": round(multi_day_trend_pct, 2),
        })
    
    return results

def main():
    try:
        dfs, dates = get_latest_n_days_bhav(n=5)
        if not dfs:
            print("ERROR: No Bhav Copy files found.")
            sys.exit(1)
        
        aggregated = aggregate_data(dfs, dates)
        
        # Identify liquid stocks for historical analysis (turnover >= 1 Crore OR volume >= 50,000)
        liquid_stocks = [s for s in aggregated if s['turnover_cr'] >= 1.0 or s['volume'] >= 50000]
        liquid_symbols = [s['symbol'] for s in liquid_stocks]
        
        # Fetch historical daily data from Yahoo Finance
        historical_data = fetch_historical_yahoo(liquid_symbols)
        
        # Enrich the aggregated stock objects with historical breakouts
        for s in aggregated:
            sym = s['symbol']
            hist = historical_data.get(sym)
            if hist:
                highs = hist['highs']
                lows = hist['lows']
                closes = hist['closes']
                volumes = hist['volumes']
                
                # 52w metrics
                h_52w = hist['fiftyTwoWeekHigh'] or (max(highs[-250:]) if highs else s['ltp'])
                l_52w = hist['fiftyTwoWeekLow'] or (min(lows[-250:]) if lows else s['ltp'])
                v_52w = max(volumes[-250:]) if volumes else s['volume']
                
                # 3m metrics (~60 trading sessions)
                h_3m = max(highs[-60:]) if len(highs) >= 60 else (max(highs) if highs else s['ltp'])
                v_3m = max(volumes[-60:]) if len(volumes) >= 60 else (max(volumes) if volumes else s['volume'])
                
                # 1m metrics (~20 trading sessions)
                h_1m = max(highs[-20:]) if len(highs) >= 20 else (max(highs) if highs else s['ltp'])
                v_1m = max(volumes[-20:]) if len(volumes) >= 20 else (max(volumes) if volumes else s['volume'])
                
                # 1w metrics (~5 trading sessions)
                h_1w = max(highs[-5:]) if len(highs) >= 5 else (max(highs) if highs else s['ltp'])
                v_1w = max(volumes[-5:]) if len(volumes) >= 5 else (max(volumes) if volumes else s['volume'])
                
                s['high_52w'] = round(float(h_52w), 2)
                s['low_52w'] = round(float(l_52w), 2)
                s['vol_52w'] = int(v_52w)
                s['high_3m'] = round(float(h_3m), 2)
                s['vol_3m'] = int(v_3m)
                s['high_1m'] = round(float(h_1m), 2)
                s['vol_1m'] = int(v_1m)
                s['high_1w'] = round(float(h_1w), 2)
                s['vol_1w'] = int(v_1w)
                
                # Breakout flags
                s['is_52w_high_breakout'] = bool(s['ltp'] >= h_52w or s['high'] >= h_52w)
                s['is_52w_vol_breakout'] = bool(s['volume'] >= v_52w)
                s['is_3m_high_breakout'] = bool(s['ltp'] >= h_3m or s['high'] >= h_3m)
                s['is_3m_vol_breakout'] = bool(s['volume'] >= v_3m)
                s['is_1m_high_breakout'] = bool(s['ltp'] >= h_1m or s['high'] >= h_1m)
                s['is_1m_vol_breakout'] = bool(s['volume'] >= v_1m)
                s['is_1w_high_breakout'] = bool(s['ltp'] >= h_1w or s['high'] >= h_1w)
                s['is_1w_vol_breakout'] = bool(s['volume'] >= v_1w)
                s['near_52w_high'] = bool((s['ltp'] / h_52w >= 0.98) and (s['ltp'] <= h_52w * 1.01))
            else:
                s['high_52w'] = None
                s['low_52w'] = None
                s['vol_52w'] = None
                s['high_3m'] = None
                s['vol_3m'] = None
                s['high_1m'] = None
                s['vol_1m'] = None
                s['high_1w'] = None
                s['vol_1w'] = None
                s['is_52w_high_breakout'] = False
                s['is_52w_vol_breakout'] = False
                s['is_3m_high_breakout'] = False
                s['is_3m_vol_breakout'] = False
                s['is_1m_high_breakout'] = False
                s['is_1m_vol_breakout'] = False
                s['is_1w_high_breakout'] = False
                s['is_1w_vol_breakout'] = False
                s['near_52w_high'] = False
        
        os.makedirs('public', exist_ok=True)
        
        output = {
            "last_updated":      datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "trading_date":      dates[0],
            "historical_dates":  dates[1:],
            "stocks":            aggregated
        }
        
        with open('public/market_data.json', 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"SUCCESS: {len(aggregated)} stocks saved to public/market_data.json")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
