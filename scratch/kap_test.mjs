import fs from "fs";

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.kap.org.tr/tr/bulten/gunluk",
};

async function main() {
  console.log("Fetching KAP disclosures...");
  try {
    const res = await fetch("https://www.kap.org.tr/tr/api/disclosures", { headers });
    if (!res.ok) {
      console.error("HTTP error:", res.status);
      return;
    }
    const data = await res.json();
    console.log(`Fetched ${data.length} disclosures from KAP.`);
    
    // Look for Portföy Dağılım Raporu
    const pdrList = data.filter((d) => {
      const title = d.basic?.title || d.title || "";
      const summary = d.basic?.summary || d.summary || "";
      const type = d.basic?.disclosureType || d.disclosureType || "";
      return title.includes("Portföy") || summary.includes("Portföy") || type.includes("PDR");
    });
    
    console.log(`Found ${pdrList.length} PDR notifications.`);
    if (pdrList.length > 0) {
      console.log("Sample PDR:", JSON.stringify(pdrList[0], null, 2));
      const idx = pdrList[0].disclosureIndex || pdrList[0].basic?.disclosureIndex;
      if (idx) {
        console.log(`Fetching detail for disclosureIndex: ${idx}`);
        const detRes = await fetch(`https://www.kap.org.tr/tr/api/disclosure/detail/${idx}`, { headers });
        const detJson = await detRes.json();
        fs.writeFileSync("scratch/kap_detail_sample.json", JSON.stringify(detJson, null, 2));
        console.log("Saved scratch/kap_detail_sample.json");
      }
    } else {
      console.log("Sample 3 disclosures:", JSON.stringify(data.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

main();
