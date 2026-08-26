import urllib.request
import json

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.kap.org.tr/tr/bulten/gunluk",
}

# 1. Fetch recent disclosures from KAP
url = "https://www.kap.org.tr/tr/api/disclosures"
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"Total disclosures fetched: {len(data)}")
        
        # Filter for Portföy Dağılım Raporu (PDR)
        pdr_list = [d for d in data if "Portföy Dağılım" in (d.get("title") or "") or "Portföy Dağılım" in (d.get("summary") or "")]
        print(f"PDR count in recent disclosures: {len(pdr_list)}")
        
        if pdr_list:
            sample = pdr_list[0]
            print("Sample PDR:", json.dumps(sample, indent=2, ensure_ascii=False))
            idx = sample.get("disclosureIndex")
            print(f"Fetching detail for index: {idx}")
            
            detail_url = f"https://www.kap.org.tr/tr/api/disclosure/detail/{idx}"
            req2 = urllib.request.Request(detail_url, headers=headers)
            with urllib.request.urlopen(req2) as resp2:
                detail_data = json.loads(resp2.read().decode("utf-8"))
                print("Detail keys:", list(detail_data.keys()))
                # Save to file
                with open("scratch/kap_sample.json", "w", encoding="utf-8") as f:
                    json.dump(detail_data, f, indent=2, ensure_ascii=False)
                print("Saved scratch/kap_sample.json")
        else:
            # Let's inspect some disclosure titles
            print("First 5 disclosure titles:")
            for d in data[:5]:
                print("-", d.get("basic", {}).get("companyName"), "|", d.get("basic", {}).get("title"), "|", d.get("basic", {}).get("disclosureType"))
except Exception as e:
    print("Error:", e)
