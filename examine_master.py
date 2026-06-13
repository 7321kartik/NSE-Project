from curl_cffi import requests
import json
import time

def examine_master():
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
    
    # Home page
    session.get("https://www.nseindia.com/", headers=headers, impersonate="chrome110", timeout=10)
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
    
    url = "https://www.nseindia.com/api/equity-master"
    res = session.get(url, headers=api_headers, impersonate="chrome110", timeout=10)
    if res.status_code == 200:
        print(json.dumps(res.json(), indent=2))
    else:
        print(f"Error: {res.status_code}")

if __name__ == "__main__":
    examine_master()
