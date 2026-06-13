import requests
import json
import time

def fetch_nse_data():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    r_home = session.get("https://www.nseindia.com/", headers=headers, timeout=10)
    print(f"Homepage Status Code: {r_home.status_code}")
    print(f"Homepage Cookies: {session.cookies.get_dict()}")
    
    # Wait a moment
    time.sleep(3)
    
    # Modify headers for API request
    api_headers = headers.copy()
    api_headers["Accept"] = "application/json, text/plain, */*"
    api_headers["Referer"] = "https://www.nseindia.com/"
    api_headers["Sec-Fetch-Dest"] = "empty"
    api_headers["Sec-Fetch-Mode"] = "cors"
    api_headers["Sec-Fetch-Site"] = "same-origin"
    
    # Try fetching Nifty 50 stock indices
    url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
    print(f"Fetching data from: {url}")
    response = session.get(url, headers=api_headers, timeout=10)
    
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

