# 【rule】
RULE-SET,SYSTEM,DIRECT

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/appstore.list,DIRECT

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/apple.list,Proxy

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/google.list,Proxy

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/wechat.list,DIRECT

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/reject.list,REJECT

RULE-SET,https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-surge.txt,REJECT

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/cn.list,DIRECT

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/netflix.list,Netflix

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/proxy.list,Proxy

RULE-SET,https://raw.githubusercontent.com/unknowntokyo/surge-list/master/telegram.list,Proxy

RULE-SET,LAN,DIRECT

GEOIP,CN,DIRECT

FINAL,Proxy,dns-failed
