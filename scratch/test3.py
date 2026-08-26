import logging
from pytefas import Crawler

c = Crawler()
try:
    df = c.fetch(start="2026-07-31", kind="YAT", columns="allocation")
    print("Columns:", df.columns.tolist())
    print("Length:", len(df))
    if len(df) > 0:
        print(df.iloc[0].to_dict())
except Exception as e:
    print("Error:", e)
