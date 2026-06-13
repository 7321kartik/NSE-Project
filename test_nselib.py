from nselib import capital_market
import pandas as pd

try:
    print("Fetching equity list...")
    eq_list = capital_market.equity_list()
    print("Success! Traded Equities Count:", len(eq_list))
    print(eq_list.head())
except Exception as e:
    print(f"Error fetching equity list: {e}")
