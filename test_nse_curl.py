from curl_cffi import requests
import json
import time

def fetch_nse_data():
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    }
    
    session = requests.Session()
    
    # Visit home page first to get cookies
    print("Visiting NSE India home page...")
    r_home = session.get("https://www.nseindia.com/", headers=headers, impersonate="chrome110", timeout=10)
    print(f"Homepage Status Code: {r_home.status_code}")
    print(f"Homepage Cookies: {session.cookies.get_dict()}")
    
    # Wait a moment
    time.sleep(3)
    
    # Try fetching Nifty 50 stock indices
    url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
    api_headers = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": "https://www.nseindia.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    }
    print(f"Fetching data from: {url}")
    response = session.get(url, headers=api_headers, impersonate="chrome110", timeout=10)
    
    print(f"Response Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Success! First 3 stocks:")
        for stock in data.get('data', [])[:3]:
            print(f"- {stock.get('symbol')}: LTP={stock.get('lastPrice')}, Volume={stock.get('totalTradedVolume')}, Turnover={stock.get('totalTradedValue')}")
    else:
        print(f"Failed to fetch. Response headers: {response.headers}")
        print(f"Failed to fetch. Response text: {response.text[:500]}")

if __name__ == "__main__":
    fetch_nse_data()
