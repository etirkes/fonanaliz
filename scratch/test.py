import logging
import json
from pytefas import Crawler
import requests

old_post = requests.Session.post

def new_post(self, url, **kwargs):
    print("=" * 40)
    print("URL:", url)
    if 'json' in kwargs:
        print("JSON_KWARG:", kwargs['json'])
    print("=" * 40)
    
    # We must remove json kwarg if we want to pass it manually or just pass kwargs
    return old_post(self, url, **kwargs)

requests.Session.post = new_post

print("Starting fetch info...")
c = Crawler()
try:
    df = c.fetch(start="2026-07-25", kind="YAT", columns="info")
    print(df.head())
except Exception as e:
    print("Error:", e)
