import json,re,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urljoin
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'assets/images/federations'; OUT.mkdir(parents=True,exist_ok=True)
DATA=json.loads((ROOT/'data/federations.json').read_text(encoding='utf-8')); UA='Mozilla/5.0 (compatible; VarzeshPortalAssetBot/1.0)'
class P(HTMLParser):
 def __init__(self): super().__init__(); self.img=[]; self.meta=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='meta' and a.get('content') and (a.get('property','').lower()=='og:image' or a.get('name','').lower()=='twitter:image'): self.meta.append(a['content'])
  if t=='img':
   u=a.get('src') or a.get('data-src') or a.get('data-lazy-src')
   if u:self.img.append((u,' '.join([a.get('alt',''),a.get('class',''),a.get('id',''),u]).lower()))
def fetch(u,cap=2500000):
 with urlopen(Request(u,headers={'User-Agent':UA}),timeout=8) as r:return r.headers.get('Content-Type','').split(';')[0].lower(),r.read(cap+1)
def save(u,base):
 try:
  typ,b=fetch(u)
  if len(b)>2500000 or not typ.startswith('image/'):return None
  ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}.get(typ)
  if not ext:return None
  p=base.with_suffix(ext);p.write_bytes(b);return p.name
 except Exception:return None
def process(e):
 slug=e['slug'];domain=e.get('domain','')
 if not domain:return {'name':e['name'],'slug':slug,'status':'no-domain'}
 base='https://'+domain.strip('/')
 try:
  typ,body=fetch(base+'/',1500000)
  if 'html' not in typ:raise ValueError('homepage is not HTML')
  p=P();p.feed(body.decode('utf-8','ignore'))
  logos=[u for u,m in p.img if re.search(r'logo|brand|crest|emblem|نشان|لوگو',m)]
  logo=None
  for u in logos[:8]:
   logo=save(urljoin(base+'/',u),OUT/(slug+'-logo'))
   if logo:break
  candidates=p.meta+[u for u,m in p.img if not re.search(r'logo|brand|crest|emblem|icon|avatar',m)]
  photos=[]
  for u in candidates:
   if len(photos)>=2:break
   n=save(urljoin(base+'/',u),OUT/(slug+'-photo-'+str(len(photos)+1)))
   if n:photos.append(n)
  return {'name':e['name'],'slug':slug,'website':base,'logo':logo,'photos':photos,'logo_found':bool(logo)}
 except Exception as ex:return {'name':e['name'],'slug':slug,'website':base,'status':'fetch-failed','error':str(ex)[:120]}
report=[]
with ThreadPoolExecutor(max_workers=12) as pool:
 for fut in as_completed([pool.submit(process,e) for e in DATA]):
  report.append(fut.result())
report.sort(key=lambda x:x['slug'])
(OUT/'download-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('entries',len(DATA),'logos',sum(bool(x.get('logo')) for x in report),'photos',sum(len(x.get('photos',[])) for x in report))
