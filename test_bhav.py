from nselib import capital_market
import pandas as pd

try:
    print("Fetching bhav copy for 12-06-2026...")
    df = capital_market.bhav_copy_equities('12-06-2026')
    print("Success!")
    print("Columns:", list(df.columns))
    print(df.head())
except Exception as e:
    print(f"Error fetching bhav copy: {e}")
