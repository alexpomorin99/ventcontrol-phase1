import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDJzgjNKe_w_wVK1ZWjWApDZ1llyOyHDZ0",
  authDomain: "vent-control-bd130.firebaseapp.com",
  projectId: "vent-control-bd130",
  storageBucket: "vent-control-bd130.firebasestorage.app",
  messagingSenderId: "731614515716",
  appId: "1:731614515716:web:de98f495dcada52ea85b51",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

const SECTIONS = [
  { id:'prep', title:'Подготовительные работы', items:[
    {id:'p1', text:'Проверка проектной документации и спецификации оборудования', tag:'doc'},
    {id:'p2', text:'Проверка комплектности оборудования и материалов по накладным', tag:'doc'},
    {id:'p3', text:'Визуальный осмотр воздуховодов: дефекты, вмятины, нарушение герметичности швов'},
    {id:'p4', text:'Проверка соответствия сечений воздуховодов проекту', tag:'critical'},
    {id:'p5', text:'Наличие сертификатов на материалы и оборудование', tag:'doc'},
    {id:'p6', text:'Разметка трасс прокладки воздуховодов согласно проекту'},
    {id:'p7', text:'Готовность строительных конструкций: проёмы, гильзы, закладные', tag:'critical'},
  ]},
  { id:'ducts', title:'Монтаж воздуховодов', items:[
    {id:'d1', text:'Установка подвесов и опор с соблюдением шага (не более 4 м)', tag:'critical'},
    {id:'d2', text:'Соответствие уклонов воздуховодов требованиям проекта'},
    {id:'d3', text:'Правильность монтажа фланцевых и бесфланцевых соединений', note:'Болты затянуты, уплотнение по всему периметру'},
    {id:'d4', text:'Герметизация всех швов и соединений герметиком', tag:'critical'},
    {id:'d5', text:'Наличие гибких виброизолирующих вставок у вентиляторов', tag:'critical'},
    {id:'d6', text:'Установка противопожарных клапанов в местах прохода через преграды', tag:'critical'},
    {id:'d7', text:'Правильная ориентация противопожарных клапанов (стрелка потока)', tag:'critical'},
    {id:'d8', text:'Наличие ревизионных люков перед клапанами и фильтрами (≥ 200 мм)', tag:'critical'},
    {id:'d9', text:'Расположение воздуховодов без конфликтов с другими коммуникациями'},
    {id:'d10', text:'Теплоизоляция воздуховодов на участках по проекту', tag:'critical'},
    {id:'d11', text:'Заземление металлических воздуховодов (при наличии требования)'},
  ]},
  { id:'equip', title:'Проверка оборудования', items:[
    {id:'e1', text:'Установка вентустановки на фундамент или виброизолирующие опоры', tag:'critical'},
    {id:'e2', text:'Горизонтальность установки агрегата (отклонение ≤ 1 мм/м)', tag:'critical'},
    {id:'e3', text:'Соответствие оборудования проектным характеристикам', tag:'doc'},
    {id:'e4', text:'Монтаж калориферов / охладителей согласно схеме'},
    {id:'e5', text:'Подключение водяного обогрева / охлаждения с контролем направления потока'},
    {id:'e6', text:'Фильтры воздуха нужного класса, направление потока соблюдено', tag:'critical'},
    {id:'e7', text:'Рекуператор: правильность подключения приточных и вытяжных воздуховодов'},
    {id:'e8', text:'Решётки, диффузоры, анемостаты установлены по проекту', note:'Тип, размер, помещение'},
    {id:'e9', text:'Монтаж клапанов балансировки и регулировочных шиберов'},
    {id:'e10', text:'Воздухозаборные и выбросные устройства установлены верно', tag:'critical'},
    {id:'e11', text:'Наличие защитных сеток на всасывающих отверстиях'},
  ]},
  { id:'elec', title:'Электрическое подключение', items:[
    {id:'el1', text:'Подключение вентиляторов и агрегатов по электрической схеме', tag:'critical'},
    {id:'el2', text:'Соответствие кабелей проекту (сечение, марка)'},
    {id:'el3', text:'Подключение защитного заземления', tag:'critical'},
    {id:'el4', text:'Шкафы управления / автоматики установлены на проектных местах'},
    {id:'el5', text:'Проверка чередования фаз (для трёхфазных двигателей)', tag:'critical', note:'Мегаомметром до подачи питания'},
    {id:'el6', text:'Настройка тепловой защиты электродвигателей', tag:'critical'},
    {id:'el7', text:'Монтаж датчиков: температуры, давления, засорения фильтров, CO₂'},
  ]},
  { id:'comm', title:'Пусконаладочные работы', items:[
    {id:'c1', text:'Первый пуск: направление вращения крыльчатки соответствует стрелке', tag:'critical'},
    {id:'c2', text:'Потребляемый ток двигателей не превышает номинал', tag:'test'},
    {id:'c3', text:'Балансировка потоков: измерение расходов воздуха в каждой ветви', tag:'test', note:'Отклонение от проекта ≤ 10%'},
    {id:'c4', text:'Проверка работы противопожарных клапанов по сигналу', tag:'test'},
    {id:'c5', text:'Регулировка клапанов и шиберов для достижения проектных расходов', tag:'test'},
    {id:'c6', text:'Измерение уровня шума и вибрации', tag:'test'},
    {id:'c7', text:'Проверка автоматики: блокировки, сигнализация, аварийное отключение', tag:'test'},
    {id:'c8', text:'Тест блокировки «вентилятор — клапан»', tag:'critical'},
    {id:'c9', text:'Испытание на герметичность воздуховодов (при необходимости)'},
    {id:'c10', text:'Тестовый прогон системы в течение 4–8 часов', tag:'test'},
  ]},
  { id:'docs', title:'Приёмка и документация', items:[
    {id:'doc1', text:'Акты на скрытые работы (закладные, трассы в конструкциях)', tag:'doc', note:'До закрытия перекрытий / стен'},
    {id:'doc2', text:'Протоколы испытаний и измерений (расходы воздуха, шум)', tag:'doc'},
    {id:'doc3', text:'Паспортизация вентиляционных систем', tag:'doc'},
    {id:'doc4', text:'Исполнительные чертежи с фактическим расположением оборудования', tag:'doc'},
    {id:'doc5', text:'Передача сертификатов и паспортов на оборудование', tag:'doc'},
    {id:'doc6', text:'Инструктаж эксплуатационного персонала', tag:'doc'},
    {id:'doc7', text:'Подписание акта приёмки в эксплуатацию', tag:'doc', note:'Заказчик + подрядчик + надзор'},
  ]},
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);
const TOTAL = ALL_ITEMS.length;
const TAG = {
  critical: { label:'Критично', color:'#ff6b35', border:'rgba(255,107,53,0.35)', bg:'rgba(255,107,53,0.08)' },
  doc:      { label:'Документ', color:'#ffd600', border:'rgba(255,214,0,0.3)',   bg:'rgba(255,214,0,0.07)' },
  test:     { label:'Тест',     color:'#00e5c8', border:'rgba(0,229,200,0.3)',   bg:'rgba(0,229,200,0.07)' },
};
const calcProgress = (checked = {}) => {
  const done = ALL_ITEMS.filter(i => checked[i.id]).length;
  return { done, pct: Math.round(done / TOTAL * 100) };
};
const statusColor = (pct) => pct === 100 ? '#00c896' : pct > 0 ? '#ffd600' : '#6b7280';
const statusLabel = (pct) => pct === 100 ? 'Завершён' : pct > 0 ? 'В работе' : 'Новый';

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, loading, accessDenied }) {
  return (
    <div style={{ minHeight:'100vh', background:'#0d0f12', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ textAlign:'center', padding:'48px 40px', background:'#151821', border:'1px solid #2a3040', borderRadius:16, maxWidth:400, width:'90%' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🌀</div>
        <div style={{ fontSize:24, fontWeight:800, letterSpacing:3, color:'#00e5c8', textTransform:'uppercase', marginBottom:8 }}>VentControl</div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:40, letterSpacing:1 }}>Управление проектами монтажа вентиляции</div>
        <button
          onClick={onLogin}
          disabled={loading}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, width:'100%', padding:'14px 24px', background:'#fff', border:'none', borderRadius:8, cursor: loading ? 'wait' : 'pointer', fontSize:15, fontWeight:600, color:'#1a1a1a', transition:'all 0.2s', opacity: loading ? 0.7 : 1 }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background='#f0f0f0')}
          onMouseLeave={e => e.currentTarget.style.background='#fff'}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'Вход...' : 'Войти через Google'}
        </button>
        <div style={{ marginTop:24, fontSize:11, color:'#4a5568', lineHeight:1.6 }}>
          Войдите чтобы получить доступ к проектам.<br/>Данные синхронизируются в реальном времени.
        </div>
      </div>
    </div>
  );
}

// ── PROJECT CARD ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick, onDelete }) {
  const { done, pct } = calcProgress(project.checked);
  const sc = statusColor(pct);
  const daysLeft = project.dateEnd ? Math.ceil((new Date(project.dateEnd) - new Date()) / 86400000) : null;
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:'#151821', border:`1px solid ${hov?sc:'#2a3040'}`, borderRadius:8, padding:'18px 20px', cursor:'pointer', position:'relative', transition:'all 0.2s', transform:hov?'translateY(-2px)':'none' }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:sc, borderRadius:'8px 0 0 8px' }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#e8eaf0', marginBottom:3 }}>{project.name||'Без названия'}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{project.client||'—'}{project.system?` · ${project.system}`:''}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={{ fontSize:10, fontFamily:'monospace', padding:'3px 8px', background:`${sc}18`, color:sc, border:`1px solid ${sc}44`, borderRadius:20 }}>{statusLabel(pct)}</span>
          {daysLeft!==null && <span style={{ fontSize:10, fontFamily:'monospace', color:daysLeft<0?'#ff6b35':daysLeft<7?'#ffd600':'#6b7280' }}>{daysLeft<0?`просрочен ${-daysLeft}д`:daysLeft===0?'сегодня':`${daysLeft} дн.`}</span>}
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
          <span style={{ fontSize:11, color:'#6b7280', fontFamily:'monospace' }}>Монтаж</span>
          <span style={{ fontSize:11, color:sc, fontFamily:'monospace', fontWeight:600 }}>{done}/{TOTAL} · {pct}%</span>
        </div>
        <div style={{ height:4, background:'#1e2330', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:pct+'%', background:sc, borderRadius:2, transition:'width 0.5s' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:16, paddingTop:10, borderTop:'1px solid #1e2330' }}>
        {[{l:'Сумма',v:project.budget},{l:'Расходы',v:project.expenses},{l:'Прибыль',v:project.grossProfit}].map(f=>(
          <div key={f.l}>
            <div style={{ fontSize:9, color:'#4a5568', textTransform:'uppercase', letterSpacing:1 }}>{f.l}</div>
            <div style={{ fontSize:12, fontWeight:600, color:f.v?'#e8eaf0':'#2a3040', fontFamily:'monospace', marginTop:2 }}>{f.v?Number(f.v).toLocaleString('ru-RU')+' ₸':'—'}</div>
          </div>
        ))}
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete();}} style={{ position:'absolute', top:10, right:12, background:'transparent', border:'none', color:'#3a4050', cursor:'pointer', fontSize:18 }}
        onMouseEnter={e=>e.currentTarget.style.color='#ff6b35'} onMouseLeave={e=>e.currentTarget.style.color='#3a4050'}>×</button>
    </div>
  );
}

// ── PROJECT DETAIL ────────────────────────────────────────────────────────────
function ProjectDetail({ project, onUpdate, onBack, user }) {
  const [openSec, setOpenSec] = useState(project.openSections||{prep:true});
  const update = (fields) => onUpdate({...project,...fields});
  const toggleItem = (id) => {
    const checked={...(project.checked||{}),[id]:!(project.checked||{})[id]};
    update({checked, lastUpdatedBy: user.displayName, lastUpdatedAt: new Date().toISOString()});
  };
  const toggleSec = (id) => { const next={...openSec,[id]:!openSec[id]}; setOpenSec(next); update({openSections:next}); };
  const {done,pct} = calcProgress(project.checked);
  const sc = statusColor(pct);
  const budget = project.budget?Number(project.budget):null;
  const grossProfit = project.grossProfit?Number(project.grossProfit):null;
  const margin = budget&&grossProfit?Math.round(grossProfit/budget*100):null;

  const inp = (id,label,placeholder,type='text') => (
    <div style={{ flex:1, minWidth:130 }}>
      <div style={{ fontSize:9, color:'#6b7280', textTransform:'uppercase', letterSpacing:1.5, marginBottom:5, fontFamily:'monospace' }}>{label}</div>
      <input type={type} value={project[id]||''} placeholder={placeholder} onChange={e=>update({[id]:e.target.value})}
        style={{ width:'100%', background:type==='date'?'rgba(255,255,255,0.04)':'transparent', border:type==='date'?'1px solid #2a3040':'none', borderBottom:type==='date'?'none':'1px solid #2a3040', borderRadius:type==='date'?4:0, color:'#e8eaf0', fontSize:13, padding:type==='date'?'6px 10px':'3px 0', outline:'none', fontFamily:'inherit' }} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0d0f12', color:'#e8eaf0', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:'#151821', borderBottom:'1px solid #2a3040', padding:'12px 18px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <button onClick={onBack} style={{ background:'transparent', border:'1px solid #2a3040', color:'#6b7280', padding:'5px 12px', cursor:'pointer', fontSize:12, borderRadius:4 }}>← Проекты</button>
          <input value={project.name||''} onChange={e=>update({name:e.target.value})} placeholder="Название проекта"
            style={{ flex:1, background:'transparent', border:'none', color:'#e8eaf0', fontSize:16, fontWeight:700, outline:'none', fontFamily:'inherit' }} />
          <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:800, color:sc }}>{pct}%</div>
        </div>
        <div style={{ height:3, background:'#1e2330', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:pct+'%', background:`linear-gradient(90deg,${sc},#00e5c8)`, transition:'width 0.5s', borderRadius:2 }} />
        </div>
        {project.lastUpdatedBy && (
          <div style={{ fontSize:10, color:'#4a5568', marginTop:6, fontFamily:'monospace' }}>
            Последнее изменение: {project.lastUpdatedBy} · {project.lastUpdatedAt ? new Date(project.lastUpdatedAt).toLocaleString('ru-RU') : ''}
          </div>
        )}
      </div>

      <div style={{ maxWidth:820, margin:'0 auto', padding:'18px 14px' }}>
        <div style={{ background:'#151821', border:'1px solid #2a3040', borderRadius:8, padding:'16px 18px', marginBottom:12 }}>
          <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:2, marginBottom:12, fontFamily:'monospace' }}>Информация</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:14 }}>{inp('client','Заказчик','Название организации')}{inp('executor','Исполнитель','ФИО / бригада')}{inp('system','Система','П1, В1, К1...')}</div>
        </div>

        <div style={{ background:'#151821', border:'1px solid #2a3040', borderRadius:8, padding:'16px 18px', marginBottom:12 }}>
          <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:2, marginBottom:12, fontFamily:'monospace' }}>Сроки исполнения</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end' }}>
            {inp('dateStart','Начало','','date')}{inp('dateEnd','Завершение','','date')}
            {project.dateStart&&project.dateEnd&&(
              <div style={{ padding:'6px 14px', background:'rgba(0,229,200,0.08)', border:'1px solid rgba(0,229,200,0.2)', borderRadius:4 }}>
                <div style={{ fontSize:9, color:'#6b7280', fontFamily:'monospace', textTransform:'uppercase' }}>Длительность</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#00e5c8', fontFamily:'monospace', marginTop:2 }}>{Math.max(0,Math.ceil((new Date(project.dateEnd)-new Date(project.dateStart))/86400000))} дн.</div>
              </div>
            )}
            {project.dateEnd&&(()=>{const dl=Math.ceil((new Date(project.dateEnd)-new Date())/86400000);const c=dl<0?'#ff6b35':dl<7?'#ffd600':'#00c896';return(
              <div style={{ padding:'6px 14px', background:`${c}12`, border:`1px solid ${c}33`, borderRadius:4 }}>
                <div style={{ fontSize:9, color:'#6b7280', fontFamily:'monospace', textTransform:'uppercase' }}>До сдачи</div>
                <div style={{ fontSize:14, fontWeight:700, color:c, fontFamily:'monospace', marginTop:2 }}>{dl<0?`−${-dl} дн.`:dl===0?'Сегодня':`${dl} дн.`}</div>
              </div>
            );})()}
          </div>
        </div>

        <div style={{ background:'#151821', border:'1px solid #2a3040', borderRadius:8, padding:'16px 18px', marginBottom:16 }}>
          <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:2, marginBottom:14, fontFamily:'monospace' }}>Финансы проекта</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:14 }}>
            {[{id:'budget',label:'Сумма проекта',color:'#e8eaf0'},{id:'expenses',label:'Бюджет расходов',color:'#ff6b35'},{id:'grossProfit',label:'Плановая вал. прибыль',color:'#00c896'}].map(f=>(
              <div key={f.id} style={{ flex:1, minWidth:130 }}>
                <div style={{ fontSize:9, color:'#6b7280', textTransform:'uppercase', letterSpacing:1.5, marginBottom:5, fontFamily:'monospace' }}>{f.label}</div>
                <input type="number" value={project[f.id]||''} placeholder="0" onChange={e=>update({[f.id]:e.target.value})}
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid #2a3040', borderRadius:4, color:f.color, fontSize:14, fontWeight:600, padding:'7px 10px', outline:'none', fontFamily:'monospace' }} />
                <div style={{ fontSize:11, color:'#4a5568', marginTop:3, fontFamily:'monospace' }}>{project[f.id]?Number(project[f.id]).toLocaleString('ru-RU')+' ₸':''}</div>
              </div>
            ))}
          </div>
          {(budget||grossProfit)&&(
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, paddingTop:14, borderTop:'1px solid #1e2330' }}>
              {[{label:'Сумма',val:budget,color:'#e8eaf0'},{label:'Расходы',val:project.expenses?Number(project.expenses):null,color:'#ff6b35'},{label:'Вал. прибыль',val:grossProfit,color:'#00c896'},
                margin!=null?{label:'Маржа',val:margin+'%',color:margin>=30?'#00c896':margin>=15?'#ffd600':'#ff6b35',raw:true}:null].filter(Boolean).map(f=>(
                <div key={f.label} style={{ flex:1, minWidth:100, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:6, border:'1px solid #1e2330' }}>
                  <div style={{ fontSize:9, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace', marginBottom:4 }}>{f.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:f.color, fontFamily:'monospace' }}>{f.raw?f.val:(f.val?Number(f.val).toLocaleString('ru-RU')+' ₸':'—')}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:2, marginBottom:10, fontFamily:'monospace' }}>Контроль монтажа · {done}/{TOTAL} пунктов</div>
        {SECTIONS.map((sec,idx)=>{
          const secDone=sec.items.filter(i=>(project.checked||{})[i.id]).length;
          const secPct=Math.round(secDone/sec.items.length*100);
          const allDone=secDone===sec.items.length;
          const isOpen=!!openSec[sec.id];
          return(
            <div key={sec.id} style={{ border:`1px solid ${allDone?'#00c896':'#2a3040'}`, marginBottom:6, background:'#151821', borderRadius:6, overflow:'hidden', transition:'border-color 0.3s' }}>
              <div onClick={()=>toggleSec(sec.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', cursor:'pointer', userSelect:'none' }}>
                <div style={{ fontSize:18, fontWeight:800, color:allDone?'#00c896':'#2a3040', minWidth:24 }}>{String(idx+1).padStart(2,'0')}</div>
                <div style={{ flex:1, fontWeight:600, fontSize:13 }}>{sec.title}</div>
                <span style={{ fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{secDone}/{sec.items.length}</span>
                <div style={{ width:44, height:4, background:'#1e2330', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:secPct+'%', background:allDone?'#00c896':'#00e5c8', borderRadius:2, transition:'width 0.4s' }} />
                </div>
                <span style={{ color:'#6b7280', fontSize:11, display:'inline-block', transform:isOpen?'rotate(90deg)':'rotate(0)', transition:'transform 0.3s' }}>▶</span>
              </div>
              {isOpen&&(
                <div style={{ borderTop:'1px solid #2a3040' }}>
                  {sec.items.map(item=>{
                    const d=!!(project.checked||{})[item.id];
                    return(
                      <div key={item.id} onClick={()=>toggleItem(item.id)}
                        style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 16px', borderBottom:'1px solid #1a1e2a', cursor:'pointer', opacity:d?0.4:1, transition:'opacity 0.2s' }}>
                        <div style={{ width:17, height:17, border:`1.5px solid ${d?'#00c896':'#3a4050'}`, background:d?'#00c896':'transparent', flexShrink:0, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#000', borderRadius:3, transition:'all 0.2s' }}>{d&&'✓'}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, lineHeight:1.5, textDecoration:d?'line-through':'none', color:d?'#6b7280':'#e8eaf0' }}>{item.text}</div>
                          {item.note&&<div style={{ fontSize:11, color:'#6b7280', fontStyle:'italic', marginTop:2 }}>{item.note}</div>}
                        </div>
                        {item.tag&&<span style={{ fontSize:9, fontFamily:'monospace', letterSpacing:1, padding:'2px 7px', textTransform:'uppercase', flexShrink:0, marginTop:3, background:TAG[item.tag].bg, color:TAG[item.tag].color, border:`1px solid ${TAG[item.tag].border}`, borderRadius:3 }}>{TAG[item.tag].label}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [loginLoading, setLoginLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [connected, setConnected] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // Firestore listener — только когда залогинен
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'projects'),
      (snap) => {
        const list = snap.docs.map(d=>({id:d.id,...d.data()}));
        list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
        setProjects(list);
        setConnected(true);
      },
      () => setConnected(false)
    );
    return () => unsub();
  }, [user]);

  const handleLogin = async () => {
    setLoginLoading(true);
    setAccessDenied(false);
    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const allowedDoc = await getDoc(doc(db, 'allowedUsers', u.email));
      if (!allowedDoc.exists() || allowedDoc.data().allowed !== true) {
        await signOut(auth);
        setAccessDenied(true);
        setLoginLoading(false);
        return;
      }
      await setDoc(doc(db, 'sessions', Date.now().toString()), {
        uid: u.uid, name: u.displayName, email: u.email,
        photo: u.photoURL, loginAt: new Date().toISOString(),
        device: navigator.userAgent,
      });
    } catch(e) { console.error(e); }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    if (window.confirm('Выйти из аккаунта?')) await signOut(auth);
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    await setDoc(doc(db,'projects',id), {
      name:newName.trim(), client:'', executor:'', system:'',
      dateStart:'', dateEnd:'', budget:'', expenses:'', grossProfit:'',
      checked:{}, openSections:{prep:true},
      createdBy: user.displayName, createdAt: new Date().toISOString(),
    });
    setNewName(''); setShowNew(false); setActiveId(id);
  };

  const updateProject = async (updated) => {
    const {id,...data} = updated;
    await setDoc(doc(db,'projects',id), data, {merge:true});
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Удалить проект?')) return;
    await deleteDoc(doc(db,'projects',id));
    if (activeId===id) setActiveId(null);
  };

  // Loading
  if (user === undefined) return (
    <div style={{ minHeight:'100vh', background:'#0d0f12', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#00e5c8', fontSize:32 }}>⏳</div>
    </div>
  );

  // Not logged in
  if (!user) return <LoginScreen onLogin={handleLogin} loading={loginLoading} />;

  const active = projects.find(p=>p.id===activeId);
  if (active) return <ProjectDetail project={active} onUpdate={updateProject} onBack={()=>setActiveId(null)} user={user} />;

  const inWork = projects.filter(p=>{const {pct}=calcProgress(p.checked);return pct>0&&pct<100;}).length;
  const done = projects.filter(p=>calcProgress(p.checked).pct===100).length;

  return (
    <div style={{ minHeight:'100vh', background:'#0d0f12', color:'#e8eaf0', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:'#151821', borderBottom:'1px solid #2a3040', padding:'14px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:3, color:'#00e5c8', textTransform:'uppercase' }}>🌀 VentControl</div>
            <div style={{ fontSize:10, color:'#6b7280', letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>Управление проектами монтажа вентиляции</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'#00c896':'#ff6b35', boxShadow:connected?'0 0 6px #00c896':'none' }} />
              <span style={{ fontSize:10, color:'#6b7280', fontFamily:'monospace' }}>{connected?'онлайн':'подключение...'}</span>
            </div>
            {/* User info */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'rgba(255,255,255,0.05)', borderRadius:20, border:'1px solid #2a3040' }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width:24, height:24, borderRadius:'50%' }} />}
              <span style={{ fontSize:12, color:'#e8eaf0', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.displayName}</span>
            </div>
            <button onClick={handleLogout} style={{ background:'transparent', border:'1px solid #2a3040', color:'#6b7280', padding:'6px 12px', cursor:'pointer', fontSize:12, borderRadius:6 }}>Выйти</button>
            <button onClick={()=>setShowNew(true)} style={{ background:'#00e5c8', border:'none', color:'#0d0f12', padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', borderRadius:6 }}>+ Новый проект</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px' }}>
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {[{label:'Всего проектов',val:projects.length,color:'#e8eaf0'},{label:'В работе',val:inWork,color:'#ffd600'},{label:'Завершено',val:done,color:'#00c896'}].map(s=>(
            <div key={s.label} style={{ flex:1, minWidth:100, background:'#151821', border:'1px solid #2a3040', borderRadius:8, padding:'14px 16px' }}>
              <div style={{ fontSize:9, color:'#6b7280', textTransform:'uppercase', letterSpacing:1.5, fontFamily:'monospace', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {showNew&&(
          <div style={{ background:'#151821', border:'1px solid #00e5c8', borderRadius:8, padding:'18px 20px', marginBottom:16 }}>
            <div style={{ fontSize:12, color:'#00e5c8', marginBottom:12, fontWeight:600 }}>Новый проект</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createProject()} placeholder="Название проекта..."
                style={{ flex:1, minWidth:200, background:'rgba(255,255,255,0.05)', border:'1px solid #2a3040', borderRadius:6, color:'#e8eaf0', fontSize:14, padding:'8px 12px', outline:'none', fontFamily:'inherit' }} />
              <button onClick={createProject} style={{ background:'#00e5c8', border:'none', color:'#000', padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', borderRadius:6 }}>Создать</button>
              <button onClick={()=>{setShowNew(false);setNewName('');}} style={{ background:'transparent', border:'1px solid #2a3040', color:'#6b7280', padding:'8px 14px', fontSize:13, cursor:'pointer', borderRadius:6 }}>Отмена</button>
            </div>
          </div>
        )}

        {projects.length===0&&!showNew&&(
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#4a5568' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:16, marginBottom:6 }}>Нет проектов</div>
            <div style={{ fontSize:13 }}>Нажмите «+ Новый проект» чтобы начать</div>
          </div>
        )}

        {projects.length>0&&(
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:12 }}>
            {projects.map(p=><ProjectCard key={p.id} project={p} onClick={()=>setActiveId(p.id)} onDelete={()=>deleteProject(p.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
