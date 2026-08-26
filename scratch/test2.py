import logging
from pytefas import Crawler

c = Crawler()
try:
    df = c.fetch(start="2026-07-27", kind="YAT", columns="info")
    print("Columns:", df.columns.tolist())
    print(df.iloc[0].to_dict())
except Exception as e:
    print("Error:", e)
