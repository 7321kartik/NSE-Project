from datetime import datetime, timedelta
from nselib import capital_market
import pandas as pd

def get_latest_bhav_copy():
    current_date = datetime.now()
    for i in range(10):
        date_str = current_date.strftime('%d-%m-%Y')
        print(f"Trying date: {date_str}...")
        try:
            df = capital_market.bhav_copy_equities(date_str)
            if df is not None and not df.empty:
                # Check if columns we need are present
                if 'TckrSymb' in df.columns and 'TtlTradgVol' in df.columns:
                    print(f"Successfully loaded data for {date_str}!")
                    # Filter for EQ series (standard equities)
                    if 'SctySrs' in df.columns:
                        df_eq = df[df['SctySrs'] == 'EQ']
                        if not df_eq.empty:
                            return df_eq, date_str
                    return df, date_str
        except Exception as e:
            print(f"No data for {date_str}: {e}")
        current_date -= timedelta(days=1)
    return None, None

if __name__ == "__main__":
    df, date_found = get_latest_bhav_copy()
    if df is not None:
        print(f"Found bhav copy for {date_found} with {len(df)} rows.")
        # Print sample
        sample = df[['TckrSymb', 'SctySrs', 'OpnPric', 'HghPric', 'LwPric', 'ClsPric', 'TtlTradgVol', 'TtlTrfVal']].head()
        print(sample)
    else:
        print("Failed to find any recent bhav copy.")
