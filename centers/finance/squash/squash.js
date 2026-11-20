(()=>{'use strict';
const $=id=>document.getElementById(id), FED='FED-SQUASH', SCHEMA=2, KEY='varzeshportal.finance.federation.squash.v1', ACCESS_CODE='124000';
const blank=()=>({schemaVersion:SCHEMA,federationId:FED,federationName:'اسکواش',updatedAt:new Date().toISOString(),transactions:[],budgets:[],documents:[],personnel:[],payroll:[]});
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x&&x.federationId===FED?{...blank(),...x,personnel:Array.isArray(x.personnel)?x.personnel:[],payroll:Array.isArray(x.payroll)?x.payroll:[]}:blank()}catch(e){return blank()}}
let db=load(),view='home',mode='treasurer';
function save(){db.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(db));$('storageState').textContent='ذخیره شد · '+new Date(db.updatedAt).toLocaleString('fa-IR')}
const num=n=>new Intl.NumberFormat('fa-IR').format(Math.round(Number(n)||0)),money=n=>num(n)+' ریال',today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=(arr,key)=>arr.reduce((a,x)=>a+Number(x[key]||0),0);
const totals=()=>({income:sum(db.transactions.filter(x=>x.type==='income'),'amount'),expense:sum(db.transactions.filter(x=>x.type==='expense'),'amount'),budget:sum(db.budgets,'amount'),commitment:sum(db.budgets,'commitment')});
const metric=(label,value,sub='')=>'<div class="metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+'</small></div>';
const empty=t=>'<div class="empty-state">'+t+'</div>';
function table(head,rows){return rows.length?'<table><thead><tr>'+head.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>':empty('هنوز اطلاعاتی ثبت نشده است.')}
function render(){const t=totals(),net=t.income-t.expense,used=t.expense+t.commitment,remaining=t.budget-used;
$('metrics').innerHTML=metric('مجموع درآمد',money(t.income))+metric('مجموع هزینه',money(t.expense))+metric('مانده خالص',money(net))+metric('اعتبار مصوب',money(t.budget));
$('reportMetrics').innerHTML=$('metrics').innerHTML;
$('recent').innerHTML=table(['تاریخ','نوع','سرفصل','شرح','مبلغ'],db.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(x=>'<tr><td>'+esc(x.date)+'</td><td class="'+x.type+'">'+(x.type==='income'?'درآمد':'هزینه')+'</td><td>'+esc(x.category)+'</td><td>'+esc(x.description)+'</td><td>'+money(x.amount)+'</td></tr>'));
$('status').innerHTML=[['رویدادهای مالی',db.transactions.length],['ردیف‌های بودجه',db.budgets.length],['اسناد ثبت‌شده',db.documents.length],['تعهدات ثبت‌شده',money(t.commitment)]].map(x=>'<div class="status-item"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join('');
$('ledgerTable').innerHTML=table(['تاریخ','نوع','سرفصل','مرکز هزینه','شرح','شماره سند','مبلغ'],db.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).filter(x=>{const f=$('filter').value,q=$('search').value.trim().toLowerCase();return(f==='all'||x.type===f)&&(!q||(x.description+' '+x.ref+' '+x.category).toLowerCase().includes(q))}).map(x=>'<tr><td>'+esc(x.date)+'</td><td class="'+x.type+'">'+(x.type==='income'?'درآمد':'هزینه')+'</td><td>'+esc(x.category)+'</td><td>'+esc(x.costCenter||'—')+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.ref||'—')+'</td><td>'+money(x.amount)+'</td></tr>'));
$('budgetMetrics').innerHTML=metric('اعتبار مصوب',money(t.budget))+metric('هزینه ثبت‌شده',money(t.expense))+metric('تعهدات',money(t.commitment))+metric('مانده پس از هزینه و تعهد',money(remaining));
$('budgetTable').innerHTML=table(['سال','عنوان ردیف','اعتبار مصوب','تعهدات','توضیح'],db.budgets.map(x=>'<tr><td>'+num(x.year)+'</td><td>'+esc(x.title)+'</td><td>'+money(x.amount)+'</td><td>'+money(x.commitment)+'</td><td>'+esc(x.note||'—')+'</td></tr>'));
$('docsTable').innerHTML=table(['نوع سند','شماره','تاریخ','مبلغ','وضعیت','شرح'],db.documents.map(x=>'<tr><td>'+esc(x.type)+'</td><td>'+esc(x.number)+'</td><td>'+esc(x.date)+'</td><td>'+money(x.amount)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.description)+'</td></tr>'));
const cats={};db.transactions.filter(x=>x.type==='expense').forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.amount));const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=entries[0]?.[1]||1;
$('categoryChart').innerHTML=entries.length?entries.map(([k,v])=>'<div class="chart-line"><span>'+esc(k)+'</span><i><em style="width:'+Math.round(v/max*100)+'%"></em></i><b>'+money(v)+'</b></div>').join(''):empty('پس از ثبت هزینه‌ها، نمودار ترکیب هزینه نمایش داده می‌شود.');
$('budgetReport').innerHTML=table(['سال','عنوان','اعتبار','هزینه کل','تعهد','مانده'],db.budgets.map(x=>'<tr><td>'+num(x.year)+'</td><td>'+esc(x.title)+'</td><td>'+money(x.amount)+'</td><td>'+money(db.transactions.filter(z=>z.type==='expense'&&z.category===x.title).reduce((a,z)=>a+Number(z.amount),0))+'</td><td>'+money(x.commitment)+'</td><td>'+money(Number(x.amount)-Number(x.commitment))+'</td></tr>'));
}
function setTab(v){view=v;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('hidden',x.id!=='tab-'+v));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===v))}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const csvCell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
function csvFile(name,headers,rows){download(name,'\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function exportTransactions(){csvFile('squash-transactions.csv',['شناسه','شناسه فدراسیون','تاریخ','نوع','سرفصل','مرکز هزینه','شرح','شماره سند','مبلغ ریال'],db.transactions.map(x=>[x.id,FED,x.date,x.type,x.category,x.costCenter,x.description,x.ref,x.amount]))}
function exportBudgets(){csvFile('squash-budgets.csv',['شناسه','شناسه فدراسیون','سال','عنوان','اعتبار ریال','تعهدات ریال','توضیح'],db.budgets.map(x=>[x.id,FED,x.year,x.title,x.amount,x.commitment,x.note]))}
function exportDocs(){csvFile('squash-documents.csv',['شناسه','شناسه فدراسیون','نوع','شماره','تاریخ','مبلغ ریال','وضعیت','شرح'],db.documents.map(x=>[x.id,FED,x.type,x.number,x.date,x.amount,x.status,x.description]))}
function backup(){download('squash-finance-backup.json',JSON.stringify(db,null,2),'application/json;charset=utf-8')}
function id(){return 'sq-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
$('loginForm').addEventListener('submit',e=>{e.preventDefault();$('loginError').textContent='';if($('accessPassword').value!==ACCESS_CODE){$('loginError').textContent='رمز ورود صحیح نیست.';return}mode=$('mode').value;$('roleText').textContent=mode==='admin'?'نمای مدیریتی نمونه · فقط پرونده اسکواش':'محیط خزانه‌داری فدراسیون اسکواش';$('login').classList.add('hidden');$('app').classList.remove('hidden');$('logout').classList.remove('hidden');render();renderPersonnel();renderPayroll();renderProfile();setTab('home')});
$('logout').addEventListener('click',()=>{$('app').classList.add('hidden');$('login').classList.remove('hidden');$('logout').classList.add('hidden')});
document.querySelectorAll('.tab').forEach(x=>x.addEventListener('click',()=>{setTab(x.dataset.tab);if(x.dataset.tab==='personnel')renderPersonnel();if(x.dataset.tab==='payroll')renderPayroll();if(x.dataset.tab==='profile')renderProfile()}));document.querySelectorAll('[data-open]').forEach(x=>x.addEventListener('click',()=>setTab(x.dataset.open)));
$('date').value=today();$('docDate').value=today();
$('txForm').addEventListener('submit',e=>{e.preventDefault();db.transactions.push({id:id(),federationId:FED,date:$('date').value,type:$('type').value,category:$('category').value,costCenter:$('costCenter').value,amount:Number($('amount').value),description:$('description').value.trim(),ref:$('ref').value.trim(),createdAt:new Date().toISOString()});save();e.target.reset();$('date').value=today();$('feedback').textContent='رویداد مالی ثبت شد.';render()});
$('budgetForm').addEventListener('submit',e=>{e.preventDefault();db.budgets.push({id:id(),federationId:FED,year:Number($('year').value),title:$('budgetTitle').value.trim(),amount:Number($('budgetAmount').value),commitment:Number($('commitment').value||0),note:$('budgetNote').value.trim()});save();e.target.reset();$('year').value=1405;$('commitment').value=0;render()});
$('docForm').addEventListener('submit',e=>{e.preventDefault();db.documents.push({id:id(),federationId:FED,type:$('docType').value,number:$('docNo').value.trim(),date:$('docDate').value,amount:Number($('docAmount').value),status:$('docStatus').value,description:$('docDesc').value.trim()});save();e.target.reset();$('docDate').value=today();render()});
$('filter').addEventListener('change',render);$('search').addEventListener('input',render);
$('backup').addEventListener('click',backup);$('exportJson').addEventListener('click',backup);$('exportTransactions').addEventListener('click',exportTransactions);$('exportBudgets').addEventListener('click',exportBudgets);$('exportDocs').addEventListener('click',exportDocs);$('reportCsv').addEventListener('click',exportTransactions);$('print').addEventListener('click',()=>window.print());
$('importBtn').addEventListener('click',()=>{const f=$('importFile').files[0];if(!f){$('importStatus').textContent='ابتدا فایل پشتیبان را انتخاب کنید.';return}const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(x.federationId!==FED||!Array.isArray(x.transactions)||!Array.isArray(x.budgets)||!Array.isArray(x.documents))throw new Error('invalid');if(!confirm('اطلاعات فعلی با نسخه پشتیبان جایگزین شود؟'))return;db={...blank(),...x};save();render();$('importStatus').textContent='بازیابی اطلاعات انجام شد.'}catch(e){$('importStatus').textContent='فایل انتخاب‌شده معتبر نیست یا متعلق به پرونده اسکواش نیست.'}};reader.readAsText(f)});

function seedPersonnel(){
 if(db.personnel.length)return;
 const first=['آرمان','پارسا','سامان','کیان','بردیا','ماهان','آریا','رادین','شایان','نیما','امیرعلی','طاها','مهراد','پویان','سینا','یاسین','اشکان','عرفان','مبین','دانیال','سپهر','آبتین','نوید','سروش','مانی','ایلیا','متین','آراد','رهام','محمدطاها','امیرحسین','علی‌رضا','هومن','بهنام','میلاد','پویا','فرزاد','کامیار','بهراد','شروین','پارسا','سام','کیارش'];
 const roles=['کارشناس اداری','کارشناس مالی','کارشناس اجرایی','کارشناس آموزش','کارشناس مسابقات','مسئول پشتیبانی'];
 db.personnel=first.map((name,i)=>({id:'demo-person-'+String(i+1).padStart(3,'0'),code:'DEMO-'+String(i+1).padStart(3,'0'),name:name+' آزمایشی',gender:i%5===0?'زن':'مرد',fatherName:'اطلاعات محرمانه',maritalStatus:i%3===0?'مجرد':'متأهل',children:i%3===0?0:i%4,birthDate:'۱۳۷'+(i%10)+'/۰'+(i%9+1)+'/۱۵',education:['کارشناسی','کارشناسی ارشد','دیپلم'][i%3],birthPlace:'اطلاعات محرمانه',issuePlace:'اطلاعات محرمانه',identityBookNo:'اطلاعات محرمانه',nationalId:'اطلاعات محرمانه',job:'اطلاعات محرمانه',start:'۱۴۰'+(i%5)+'/۰'+(i%9+1)+'/۰۱',financialContractCode:['01','02','03'][i%3],financialContractType:['قرارداد مدت‌معین','قرارداد پروژه‌ای','همکاری پاره‌وقت'][i%3],workplace:'ساختمان فدراسیون',hasInsurance:i%4!==0,bankName:'اطلاعات محرمانه',accountNumber:'اطلاعات محرمانه',phone:'اطلاعات محرمانه',unit:'فدراسیون اسکواش',type:['تمام‌وقت','پاره‌وقت','پروژه‌ای'][i%3],status:'فعال',dailyBase:Math.round((4200000+(i%7)*175000)/50000)*50000,createdAt:new Date().toISOString()}));
}
const confidential='اطلاعات محرمانه';
function renderPersonnel(){
 const q=$('personSearch').value.trim().toLowerCase();
 const rows=db.personnel.filter(p=>(p.code+' '+p.name).toLowerCase().includes(q));
 $('personnelTable').innerHTML=table(['کد پرسنلی','نام نمایشی','جنسیت','وضعیت تأهل','تحصیلات','تاریخ شروع','بیمه','اطلاعات هویتی','سمت'],rows.map(p=>'<tr><td>'+esc(p.code)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.gender)+'</td><td>'+esc(p.maritalStatus)+'</td><td>'+esc(p.education)+'</td><td>'+esc(p.start)+'</td><td>'+(p.hasInsurance?'دارد':'ندارد')+'</td><td>'+confidential+'</td><td>'+confidential+'</td></tr>'));
 const options=db.personnel.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.code+' · '+p.name)+'</option>').join('');
 $('payEmployee').innerHTML=options;$('profileEmployee').innerHTML=options;
}
function renderPayroll(){
 $('payrollTable').innerHTML=table(['کد پرسنلی','نام نمایشی','سال','ماه','حقوق پایه','مزایا','کسورات','خالص پرداختی','عملیات'],db.payroll.slice().sort((a,b)=>(b.year+b.month).localeCompare(a.year+a.month)).map(p=>'<tr><td>'+esc(p.employeeCode)+'</td><td>'+esc(p.employeeName)+'</td><td>'+num(p.year)+'</td><td>'+esc(p.monthName)+'</td><td>'+money(p.base)+'</td><td>'+money(p.benefits)+'</td><td>'+money(p.deductions)+'</td><td><b>'+money(p.net)+'</b></td><td><button class="text-btn" data-slip="'+esc(p.id)+'">چاپ فیش</button></td></tr>'));
}
function renderProfile(){
 const p=db.personnel.find(x=>x.id===$('profileEmployee').value)||db.personnel[0];
 if(!p){$('personProfile').innerHTML=empty('پرونده‌ای وجود ندارد.');return}
 const pays=db.payroll.filter(x=>x.employeeId===p.id).sort((a,b)=>(b.year+b.month).localeCompare(a.year+a.month));
 $('personProfile').innerHTML='<div class="profile-head"><div><span class="pill">'+esc(p.code)+'</span><h2>'+esc(p.name)+'</h2><p class="muted">'+confidential+'</p></div><div class="profile-total"><small>مجموع خالص پرداختی ثبت‌شده</small><strong>'+money(pays.reduce((a,x)=>a+x.net,0))+'</strong></div></div><div class="profile-details"><span>وضعیت همکاری: <b>'+esc(p.status)+'</b></span><span>واحد سازمانی: <b>'+esc(p.unit)+'</b></span><span>نوع قرارداد: <b>'+esc(p.financialContractType)+'</b></span><span>وضعیت بیمه: <b>'+(p.hasInsurance?'دارای بیمه':'فاقد بیمه')+'</b></span><span>شماره تماس: <b>'+confidential+'</b></span><span>شماره حساب: <b>'+confidential+'</b></span></div><h3>تاریخچه پرداخت</h3>'+table(['سال','ماه','خالص پرداختی'],pays.map(x=>'<tr><td>'+num(x.year)+'</td><td>'+esc(x.monthName)+'</td><td>'+money(x.net)+'</td></tr>'));
}
function printSlip(id){
 const p=db.payroll.find(x=>x.id===id);if(!p)return;
 const w=window.open('','_blank','width=760,height=650');if(!w)return;
 w.document.write('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>فیش حقوقی آزمایشی</title><style>body{font-family:Tahoma;padding:30px;color:#183d58}h2{margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:20px}td{border:1px solid #ccd9e2;padding:12px}</style><h2>فیش حقوقی آزمایشی فدراسیون اسکواش</h2><p>کد پرسنلی: '+esc(p.employeeCode)+' · '+esc(p.employeeName)+'</p><p>دوره: '+num(p.year)+' / '+esc(p.monthName)+'</p><table><tr><td>حقوق پایه</td><td>'+money(p.base)+'</td></tr><tr><td>مزایا</td><td>'+money(p.benefits)+'</td></tr><tr><td>کسورات</td><td>'+money(p.deductions)+'</td></tr><tr><td><b>خالص پرداختی</b></td><td><b>'+money(p.net)+'</b></td></tr></table><p>این فیش صرفاً داده آزمایشی است.</p><script>window.onload=()=>window.print()<\/script></html>');w.document.close();
}
function bindPersonnel(){
 $('personSearch').addEventListener('input',renderPersonnel);
 $('profileEmployee').addEventListener('change',renderProfile);
 $('payBase').addEventListener('input',updatePayPreview);$('payBenefits').addEventListener('input',updatePayPreview);$('payDeductions').addEventListener('input',updatePayPreview);
 $('payrollForm').addEventListener('submit',e=>{e.preventDefault();const p=db.personnel.find(x=>x.id===$('payEmployee').value);if(!p)return;
 const year=String($('payYear').value),month=$('payMonth').value;
 if(db.payroll.some(x=>x.employeeId===p.id&&String(x.year)===year&&x.month===month)){$('payFeedback').textContent='برای این شخص در این ماه فیش ثبت شده است.';return}
 const base=Number($('payBase').value),benefits=Number($('payBenefits').value||0),deductions=Number($('payDeductions').value||0);
 if(base+benefits<deductions){$('payFeedback').textContent='کسورات نمی‌تواند از مجموع حقوق و مزایا بیشتر باشد.';return}
 const monthName=$('payMonth').selectedOptions[0].textContent,net=base+benefits-deductions;
 db.payroll.push({id:id(),employeeId:p.id,employeeCode:p.code,employeeName:p.name,year,month,monthName,base,benefits,deductions,net,note:$('payNote').value.trim(),createdAt:new Date().toISOString()});
 db.transactions.push({id:id(),federationId:FED,date:today(),type:'expense',category:'حقوق و دستمزد',costCenter:'ستاد فدراسیون',amount:net,description:'حقوق آزمایشی '+monthName+' '+year+' · '+p.code,ref:p.code,createdAt:new Date().toISOString()});
 save();e.target.reset();$('payYear').value=1405;$('payBase').value=180000000;$('payBenefits').value=0;$('payDeductions').value=0;$('payFeedback').textContent='فیش ثبت شد و هزینه آن به دفتر مالی افزوده شد.';updatePayPreview();render();renderPayroll();renderProfile();
 });
 document.addEventListener('click',e=>{const b=e.target.closest('[data-slip]');if(b)printSlip(b.dataset.slip)});
}
function updatePayPreview(){const n=Number($('payBase').value||0)+Number($('payBenefits').value||0)-Number($('payDeductions').value||0);$('payPreview').textContent='خالص پرداختی: '+money(n)}

seedPersonnel();bindPersonnel();renderPersonnel();renderPayroll();
if(!localStorage.getItem(KEY))save();$('storageState').textContent='ذخیره محلی در همین مرورگر';
})();