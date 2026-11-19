import json, re, time, ssl
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/images/federations'
OUT.mkdir(parents=True,exist_ok=True)
DATA_PATH=ROOT/'data/federations.json'
DATA=json.loads(DATA_PATH.read_text(encoding='utf-8'))
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
CTX=ssl.create_default_context()
CTX.check_hostname=False
CTX.verify_mode=ssl.CERT_NONE

def get(url,limit=1800000,timeout=14):
    req=Request(url,headers={'User-Agent':UA,'Accept':'text/html,image/avif,image/webp,image/*,*/*'})
    with urlopen(req,timeout=timeout,context=CTX) as r:
        return r.headers.get('Content-Type','').split(';')[0].lower(),r.read(limit+1)

def norm(s):
    s=(s or '').replace('ي','ی').replace('ك','ک').replace('\u200c',' ').replace('‌',' ')
    s=re.sub(r'[^\w\u0600-\u06ff]+',' ',s.lower())
    return ' '.join(s.split())

class SourceParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.records=[]; self.pending_logo=None; self.current=None
        self.in_heading=False; self.heading=''; self.in_a=False; self.href=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); src=a.get('src') or a.get('data-src') or a.get('data-lazy-src') or ''
        if tag=='img' and ('federartion-logo' in src.lower() or 'federation-logo' in src.lower()):
            self.pending_logo=urljoin('https://bamorabi.ir/',src)
        if tag in ('h2','h3','h4'):
            self.in_heading=True; self.heading=''
        if tag=='a':
            self.in_a=True; self.href=a.get('href','')
    def handle_data(self,data):
        if self.in_heading:self.heading+=data
    def handle_endtag(self,tag):
        if tag in ('h2','h3','h4') and self.in_heading:
            title=' '.join(self.heading.split())
            if title and self.pending_logo:
                self.records.append({'name':title,'logo_url':self.pending_logo,'website':''})
                self.pending_logo=None
            elif title:
                self.records.append({'name':title,'logo_url':'','website':''})
            self.current=len(self.records)-1 if self.records else None
            self.in_heading=False
        if tag=='a':
            if self.current is not None and self.href.startswith('http') and 'bamorabi.ir' not in self.href and not self.records[self.current]['website']:
                self.records[self.current]['website']=self.href
            self.in_a=False; self.href=''

def ext_for(content_type,body):
    if content_type=='image/png' or body.startswith(b'\x89PNG'): return '.png'
    if content_type in ('image/jpeg','image/jpg') or body.startswith(b'\xff\xd8'): return '.jpg'
    if content_type=='image/webp' or body[:4]==b'RIFF' and body[8:12]==b'WEBP': return '.webp'
    if content_type=='image/gif' or body.startswith(b'GIF8'): return '.gif'
    return None

def save_image(url,stem):
    try:
        ct,b=get(url,limit=2500000,timeout=18)
        ext=ext_for(ct,b)
        if not ext or len(b)<500 or len(b)>2500000:return None
        path=OUT/(stem+ext); path.write_bytes(b); return path.name
    except Exception:return None

def match_item(title):
    n=norm(title)
    aliases={
      'فدراسیون اسکی و ورزش های زمستانی':'اسکی و ورزش های زمستانی',
      'فدراسیون ورزش های آبی':'شنا شیرجه و واترپلو',
      'فدراسیون ورزش های جانبازان و توان یابان':'پاراوزنه برداری و ورزش های جانبازان و توان یابان',
      'فدراسیون ورزش های زورخانه ای و کشتی پهلوانی':'پهلوانی و زورخانه ای',
      'فدراسیون کوه نوردی و صعودهای ورزشی':'کوه نوردی و صعودهای ورزشی',
      'فدراسیون ورزش بیماران خاص و پیوند اعضاء':'ورزش بیماران خاص و پیوند اعضا',
      'فدراسیون ورزش های روستایی و بازی های بومی و محلی':'ورزش های روستایی عشایری و بازی های بومی محلی',
      'فدراسیون ورزش های سه گانه':'ورزش های سه گانه',
      'فدراسیون انجمن های ورزش های رزمی':'انجمن های ورزش های رزمی',
      'فدراسیون ورزش های همگانی':'ورزش های همگانی',
      'فدراسیون ورزش های ناشنوایان':'ورزش ناشنوایان',
      'فدراسیون ورزش دانش آموزی':'ورزش دانش آموزی',
      'فدراسیون ملی ورزش های دانشگاهی':'ورزش های دانشگاهی',
      'فدراسیون وزنه برداری':'وزنه برداری',
      'فدراسیون ورزش کارگری':'ورزش کارگری',
    }
    n=norm(aliases.get(n,title))
    for e in DATA:
        if norm(e['name'])==n:return e
    # explicit common short labels
    for e in DATA:
        en=norm(e['name'])
        if n and (n in en or en in n) and min(len(n),len(en))>5:return e
    return None

def collect_bamorabi():
    url='https://bamorabi.ir/sports-federations/'
    ct,body=get(url,limit=4000000,timeout=25)
    p=SourceParser();p.feed(body.decode('utf-8','ignore'))
    report=[]; seen=set()
    for rec in p.records:
        e=match_item(rec['name'])
        if not e or e['slug'] in seen:continue
        seen.add(e['slug'])
        saved=save_image(rec['logo_url'],e['slug']+'-logo') if rec['logo_url'] else None
        if rec['website']:
            host=urlparse(rec['website']).netloc.lower().replace('www.','')
            # use this listing only as an additional verified candidate, not if the record has a clearly established domain
            if host: e['domain']=host
        if saved:report.append({'slug':e['slug'],'name':e['name'],'logo':saved,'source':rec['logo_url'],'source_type':'Bamorabi logo directory'})
    DATA_PATH.write_text(json.dumps(DATA,ensure_ascii=False,indent=2),encoding='utf-8')
    # Keep the public directory cards aligned with the current official domains.
    index_path=ROOT/'centers'/'federations.html'
    if index_path.exists():
        html=index_path.read_text(encoding='utf-8')
        rows=[[e['name'],e.get('short',e['name']),e.get('domain',''),e['slug'],e.get('description','')] for e in DATA]
        js=json.dumps(rows,ensure_ascii=False,separators=(',',':'))
        html=re.sub(r'const federations=\[.*?\];','const federations='+js+';',html,flags=re.S)
        index_path.write_text(html,encoding='utf-8')
    return report

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=''; self.meta=''; self.headings=[]; self.paragraphs=[]
        self.capture=None; self.buf=[]; self.skip=0
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if t in ('script','style','nav','footer','header'): self.skip+=1
        if self.skip:return
        if t=='meta' and a.get('name','').lower() in ('description','og:description'):
            self.meta=a.get('content','')[:500]
        if t=='title':self.capture='title';self.buf=[]
        elif t in ('h1','h2','h3'):self.capture='heading';self.buf=[]
        elif t=='p':self.capture='p';self.buf=[]
    def handle_data(self,d):
        if self.capture is not None and not self.skip:self.buf.append(d)
    def handle_endtag(self,t):
        if t in ('script','style','nav','footer','header'):
            self.skip=max(0,self.skip-1);return
        if self.capture and ((self.capture=='title' and t=='title') or (self.capture=='heading' and t in ('h1','h2','h3')) or (self.capture=='p' and t=='p')):
            s=re.sub(r'\s+',' ',' '.join(self.buf)).strip()
            if self.capture=='title' and s:self.title=s[:180]
            elif self.capture=='heading' and s and len(s)>2:self.headings.append(s[:140])
            elif self.capture=='p' and len(s)>=65 and s not in self.paragraphs:self.paragraphs.append(s[:650])
            self.capture=None;self.buf=[]

def fetch_profile(e):
    domain=(e.get('domain') or '').strip()
    if not domain:return e['slug'],{'status':'no-official-domain'}
    urls=['https://'+domain,'http://'+domain]
    last=''
    for url in urls:
        try:
            ct,body=get(url,limit=2200000,timeout=13)
            if 'html' not in ct:continue
            p=TextParser();p.feed(body.decode('utf-8','ignore'))
            return e['slug'],{'website':url,'title':p.title,'description':p.meta,'headings':p.headings[:12],'paragraphs':p.paragraphs[:8],'status':'collected' if (p.paragraphs or p.meta) else 'limited'}
        except Exception as ex:last=str(ex)[:160]
    return e['slug'],{'website':'https://'+domain,'status':'fetch-failed','error':last}

def inject_profiles(profiles):
    for e in DATA:
        slug=e['slug']; path=ROOT/'centers'/'federations'/(slug+'.html')
        if not path.exists():continue
        prof=profiles.get(slug)
        if not prof or prof.get('status') not in ('collected','limited'):continue
        # Replace the generic placeholder panels with concise material actually found on the official site.
        items=[]
        desc=prof.get('description','').strip()
        if desc:items.append('<p>'+esc(desc)+'</p>')
        for para in prof.get('paragraphs',[])[:7]:
            items.append('<p>'+esc(para)+'</p>')
        if not items:continue
        heads=prof.get('headings',[])
        topics='<ul class="list">'+''.join('<li>'+esc(x)+'</li>' for x in heads[:12])+'</ul>' if heads else '<p>در صفحه اصلی منبع، فهرست موضوعات تفصیلی قابل استخراج نبود.</p>'
        source_url=prof.get('website','')
        content_block='<div class="cols"><div><section class="panel"><h2>معرفی و مطالب منتشرشده در پایگاه رسمی</h2>'+''.join(items)+'</section><section class="panel"><h2>بخش‌ها و موضوعات قابل دسترسی</h2>'+topics+'</section></div><aside><section class="panel"><h2>منبع اطلاعات</h2><p>این محتوا از صفحه عمومی وب‌سایت رسمی معرفی‌شده برای این مجموعه استخراج شده است. برای خبرها و اطلاعات به‌روز، به منبع اصلی مراجعه کنید.</p><p><a href="'+esc(source_url)+'" target="_blank" rel="noopener">ورود به پایگاه رسمی</a></p><div class="facts"><div class="fact"><b>عنوان صفحه</b><span>'+esc(prof.get('title') or e['name'])+'</span></div><div class="fact"><b>وضعیت منبع</b><span>دریافت‌شده از وب‌سایت</span></div></div></section></aside></div>'
        html=path.read_text(encoding='utf-8')
        html=re.sub(r'<div class="cols">.*?</div></div></main>',content_block+'</main>',html,flags=re.S)
        m=re.search(r'<a class="action" href="[^"]*" target="_blank" rel="noopener">',html)
        if m and source_url:
            html=html[:m.start()]+'<a class="action" href="'+esc(source_url)+'" target="_blank" rel="noopener">'+html[m.end():]
        html=html.replace('onerror="this.style.display=\\'none\\'"','onerror="if(!this.dataset.try){this.dataset.try=\\'1\\';this.src=this.src.replace(/\\\\.png$/i,\\'.jpg\\')}else if(this.dataset.try===\\'1\\'){this.dataset.try=\\'2\\';this.src=this.src.replace(/\\\\.(png|jpg)$/i,\\'.webp\\')}else{this.style.display=\\'none\\'}"')
        path.write_text(html,encoding='utf-8')

def esc(s):
    return (str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;'))

def main():
    logo_report=collect_bamorabi()
    # Pull content from the official homepages; network failures are retained in the report.
    profiles={}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures=[pool.submit(fetch_profile,e) for e in DATA]
        for f in as_completed(futures):
            slug,profile=f.result();profiles[slug]=profile
    inject_profiles(profiles)
    # merge reports and keep previous official-source image findings
    old=[]
    rp=OUT/'download-report.json'
    if rp.exists():
        try:old=json.loads(rp.read_text(encoding='utf-8'))
        except Exception:old=[]
    by={x.get('slug'):x for x in old if x.get('slug')}
    for x in logo_report:
        row=by.setdefault(x['slug'],{'slug':x['slug'],'name':x['name']})
        row['directory_logo']=x['logo'];row['directory_logo_source']=x['source']
    for slug,profile in profiles.items():
        row=by.setdefault(slug,{'slug':slug})
        row['official_content_status']=profile.get('status')
        row['official_content_url']=profile.get('website')
        row['official_content_paragraphs']=len(profile.get('paragraphs',[]))
        if profile.get('error'):row['official_content_error']=profile['error']
    rp.write_text(json.dumps(sorted(by.values(),key=lambda x:x.get('slug','')),ensure_ascii=False,indent=2),encoding='utf-8')
    print('Bamorabi logos:',len(logo_report),'official content pages:',sum(x.get('status') in ('collected','limited') for x in profiles.values()),'/',len(DATA))

# Trigger official source and image collection on updates.
if __name__=='__main__':main()
