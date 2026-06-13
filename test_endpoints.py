from curl_cffi import requests
import json
import time

def test_endpoints():
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
    
    # 1. Home page request to set cookies
    print("1. Requesting Home Page...")
    r = session.get("https://www.nseindia.com/", headers=headers, impersonate="chrome110", timeout=10)
    print(f"Status: {r.status_code}")
    print(f"Cookies after home: {session.cookies.get_dict()}")
    print("-" * 50)
    
    time.sleep(2)
    
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
    
    # Test URLs
    urls = [
        "https://www.nseindia.com/api/marketStatus",
        "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050",
        "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK",
        "https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O",
        "https://www.nseindia.com/api/equity-master"
    ]
    
    for url in urls:
        print(f"Testing URL: {url}")
        try:
            res = session.get(url, headers=api_headers, impersonate="chrome110", timeout=10)
            print(f"Status: {res.status_code}")
            if res.status_code == 200:
                print(f"Success! Data keys: {list(res.json().keys()) if isinstance(res.json(), dict) else 'List'}")
                if "data" in res.json():
                    print(f"Data length: {len(res.json()['data'])}")
            else:
                print(f"Response text start: {res.text[:150]}")
        except Exception as e:
            print(f"Error: {e}")
        print("-" * 50)
        time.sleep(2)

if __name__ == "__main__":
    test_endpoints()
