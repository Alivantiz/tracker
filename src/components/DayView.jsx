import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { todayStr, fmtMoney, calcDayStats } from '../utils'

function dateAdd(str, days) {
  const d = new Date(str + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function dateFmt(str) {
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
}

export default function DayView({ onDateChange }) {
  const [date, setDate]               = useState(todayStr())
  const [tab, setTab]                 = useState('shops') // shops | expenses
  const [shops, setShops]             = useState([])
  const [materials, setMaterials]     = useState([])
  const [dayId, setDayId]             = useState(null)
  const [baked, setBaked]             = useState(0)
  const [showBakedModal, setShowBakedModal] = useState(false)
  const [bakedInput, setBakedInput]   = useState('')
  const [sales, setSales]             = useState({})
  const [expenses, setExpenses]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [saveStatus, setSaveStatus]   = useState('idle')
  const saveTimers = useRef({})
  const saveStatusTimer = useRef(null)

  useEffect(() => { onDateChange?.(date) }, [date])

  useEffect(() => {
    supabase.from('shops').select('*').order('sort_order').then(({ data }) => setShops(data || []))
    supabase.from('materials').select('*').order('sort_order').then(({ data }) => setMaterials(data || []))
  }, [])

  const loadDay = useCallback(async () => {
    setLoading(true)
    let { data: day } = await supabase.from('days').select('id,baked').eq('date', date).maybeSingle()
    if (!day) {
      const { data: nd } = await supabase.from('days').insert({ date, baked: 0 }).select('id,baked').single()
      day = nd
    }
    setDayId(day.id)
    setBaked(0)  // reset before loading
    const dayBaked = day.baked || 0
    setBaked(dayBaked)
    if (!dayBaked && date === new Date().toISOString().slice(0,10)) { setBakedInput(''); setShowBakedModal(true) }
    else setShowBakedModal(false)

    const [{ data: salesData }, { data: expData }] = await Promise.all([
      supabase.from('sales').select('*').eq('day_id', day.id),
      supabase.from('expenses').select('*').eq('day_id', day.id).order('created_at'),
    ])
    const map = {}
    ;(salesData || []).forEach(s => { map[s.shop_id] = s })
    setSales(map)
    setExpenses(expData || [])
    setLoading(false)
  }, [date])

  useEffect(() => { loadDay() }, [loadDay])

  function triggerSaveStatus() {
    setSaveStatus('saving')
    clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = setTimeout(() => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 800)
  }

  async function saveBaked() {
    const val = parseInt(bakedInput) || 0
    if (!val) return
    setBaked(val); setShowBakedModal(false)
    await supabase.from('days').update({ baked: val }).eq('id', dayId)
  }

  function updateSaleLocal(shopId, field, value) {
    const shop = shops.find(s => s.id === shopId)
    const cur = sales[shopId] || { quantity:0, price: shop?.default_price || 0, payment_type:'Наличка', returns:0, bonus:0 }
    const upd = { ...cur, [field]: value }
    setSales(prev => ({ ...prev, [shopId]: upd }))
    triggerSaveStatus()
    const key = `${shopId}_${field}`
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(async () => {
      if (cur.id) {
        await supabase.from('sales').update({ [field]: value }).eq('id', cur.id)
      } else {
        const { data } = await supabase.from('sales').upsert({
          day_id: dayId, shop_id: shopId,
          quantity: upd.quantity || 0,
          price: upd.price || shop?.default_price || 0,
          payment_type: upd.payment_type || 'Наличка',
          returns: upd.returns || 0,
          bonus: upd.bonus || 0,
        }).select().single()
        if (data) setSales(prev => ({ ...prev, [shopId]: data }))
      }
    }, 600)
  }

  async function updateSalePayment(shopId, value) {
    const shop = shops.find(s => s.id === shopId)
    const cur = sales[shopId] || { quantity:0, price: shop?.default_price || 0, payment_type:'Наличка', returns:0, bonus:0 }
    setSales(prev => ({ ...prev, [shopId]: { ...cur, payment_type: value } }))
    if (cur.id) {
      await supabase.from('sales').update({ payment_type: value }).eq('id', cur.id)
    } else {
      const { data } = await supabase.from('sales').upsert({
        day_id: dayId, shop_id: shopId,
        quantity: cur.quantity || 0, price: cur.price || shop?.default_price || 0,
        payment_type: value, returns: cur.returns || 0, bonus: cur.bonus || 0,
      }).select().single()
      if (data) setSales(prev => ({ ...prev, [shopId]: data }))
    }
  }

  async function addMaterialExpense(matId, qty) {
    const mat = materials.find(m => m.id === matId)
    if (!mat) return
    const amount = qty * (mat.price_per_unit || 0)
    const name = `${mat.name} × ${qty} ${mat.unit}`
    const { data } = await supabase.from('expenses').insert({ day_id: dayId, name, amount }).select().single()
    if (data) setExpenses(prev => [...prev, data])
  }

  function updateExpenseLocal(id, fields) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e))
    triggerSaveStatus()
    const key = `exp_${id}_${Object.keys(fields)[0]}`
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(async () => {
      await supabase.from('expenses').update(fields).eq('id', id)
    }, 600)
  }

  async function removeExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    await supabase.from('expenses').delete().eq('id', id)
  }

  // Stats
  const salesArr = shops.map(sh => ({ ...sales[sh.id], shop_id: sh.id }))
  const stats = calcDayStats(salesArr, expenses, [], [])
  const { byPayment } = stats
  const activePayments = Object.entries(byPayment).filter(([, v]) => v !== 0)
  const totalBonus = shops.reduce((a, sh) => a + (parseInt(sales[sh.id]?.bonus) || 0), 0)
  const remaining = Math.max(0, baked - stats.net - totalBonus)
  const progressPct = baked > 0 ? Math.min(100, Math.round(((stats.net + totalBonus) / baked) * 100)) : 0

  const doneShops = shops.filter(sh => (sales[sh.id]?.quantity || 0) > 0).length

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  const isToday = date === todayStr()
  const TABS = [
    { key:'shops',    label:`🏪 Магазины (${doneShops}/${shops.length})` },
    { key:'expenses', label:'💸 Расходы' },
  ]

  return (
    <div className="page fade-in">

      {/* ── МОДАЛКА: Сколько испёк ── */}
      {showBakedModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:18, padding:24, width:'100%', maxWidth:320, textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:8 }}>🥖</div>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>{dateFmt(date)}</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Сколько лепёшек испёк сегодня?</div>
            <input className="input" type="number" inputMode="numeric" value={bakedInput}
              onChange={e => setBakedInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveBaked()}
              placeholder="0" autoFocus style={{ textAlign:'center', fontSize:28, fontWeight:800, padding:14, marginBottom:16 }} />
            <button className="btn-primary" onClick={saveBaked}
              disabled={!bakedInput || parseInt(bakedInput) <= 0}
              style={{ width:'100%', opacity: (!bakedInput || parseInt(bakedInput) <= 0) ? .4 : 1 }}>
              Готово ✓
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="header">
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontWeight:700 }}>Рабочий день</div>

        {/* Date nav */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <button onClick={() => setDate(prev => dateAdd(prev, -1))} style={navBtn}>‹</button>
          <div style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:'var(--text)' }}>{dateFmt(date)}</div>
          <button onClick={() => setDate(prev => dateAdd(prev, 1))} style={navBtn}>›</button>
          {!isToday && (
            <button onClick={() => setDate(todayStr())} style={{ ...navBtn, borderColor:'var(--accent)', color:'var(--accent)', fontSize:11, padding:'6px 10px' }}>Сегодня</button>
          )}
        </div>

        {/* Profit strip */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
          <ProfitTile label="Выручка"  value={fmtMoney(stats.revenue)}  color="var(--blue)" />
          <ProfitTile label="Расходы"  value={fmtMoney(stats.totalCosts)} color="var(--red)" />
          <ProfitTile label="Прибыль"  value={fmtMoney(stats.profit)}
            color={stats.profit >= 0 ? 'var(--green)' : 'var(--red)'} highlight={stats.profit !== 0} />
        </div>

        {/* Save status */}
        {saveStatus !== 'idle' && (
          <div style={{ textAlign:'right', fontSize:10, color: saveStatus==='saved'?'var(--green)':'var(--muted)', marginBottom:6 }}>
            {saveStatus==='saving' ? '⏳ Сохраняется...' : '✓ Сохранено'}
          </div>
        )}

        {/* Progress bar */}
        {baked > 0 && (
          <div style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>
                🥖 <span style={{ color:'var(--green)', fontWeight:800 }}>{stats.net}</span>
                {totalBonus > 0 && <span style={{ color:'var(--accent)' }}> + 🎁{totalBonus}</span>}
                {' '}из <span style={{ color:'var(--text)' }}>{baked}</span> шт
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:11, color: remaining>0?'var(--accent)':'var(--green)', fontWeight:700 }}>
                  {remaining>0 ? `ост: ${remaining} шт` : '✓ всё'}
                </span>
                <button onClick={() => { setBakedInput(String(baked)); setShowBakedModal(true) }}
                  style={{ background:'none', border:'none', color:'var(--muted)', fontSize:13, cursor:'pointer', padding:'0 2px' }}>✏️</button>
              </div>
            </div>
            <div style={{ background:'var(--border)', borderRadius:4, height:5 }}>
              <div style={{ width:progressPct+'%', height:5, borderRadius:4, background:progressPct>=100?'var(--green)':'var(--accent)', transition:'width .3s ease', minWidth:progressPct>0?4:0 }} />
            </div>
          </div>
        )}

        {/* ── TOP TABS ── */}
        <div style={{ display:'flex', gap:4, marginTop:4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex:1, padding:'7px 4px', border:'1px solid', borderRadius:8,
              fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s',
              background: tab===t.key ? 'var(--accent)' : 'var(--bg2)',
              borderColor: tab===t.key ? 'var(--accent)' : 'var(--border)',
              color: tab===t.key ? '#000' : 'var(--muted)',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: МАГАЗИНЫ ── */}
      {tab === 'shops' && (
        <div style={{ padding:'12px 12px 0' }}>
          {shops.map((sh, idx) => {
            const s = sales[sh.id] || {}
            const q = parseFloat(s.quantity) || 0
            const r = parseFloat(s.returns) || 0
            const b = parseInt(s.bonus) || 0
            const p = parseFloat(s.price) || parseFloat(sh.default_price) || 0
            const sum = (q - r) * p
            return (
              <div className="card" key={sh.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontWeight:700, fontSize:15 }}><span style={{ color:'var(--muted)', fontSize:12, fontWeight:600, marginRight:5 }}>#{idx+1}</span>{sh.name}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {b > 0 && <span style={{ fontSize:11, color:'var(--accent)' }}>🎁 {b} шт</span>}
                    <span style={{ color: sum>0?'var(--green)':sum<0?'var(--red)':'var(--muted)', fontWeight:700, fontSize:14 }}>
                      {sum !== 0 ? fmtMoney(sum) : '—'}
                    </span>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginBottom:6 }}>
                  <Field label="Продано">
                    <input className="input" type="number" inputMode="numeric" placeholder="шт"
                      value={s.quantity||''} onChange={e => updateSaleLocal(sh.id,'quantity',parseInt(e.target.value)||0)} />
                  </Field>
                  <Field label="↩ Возврат" labelColor="rgba(224,82,82,0.8)">
                    <input className="input" type="number" inputMode="numeric" placeholder="шт"
                      value={s.returns||''} onChange={e => updateSaleLocal(sh.id,'returns',parseInt(e.target.value)||0)}
                      style={{ color:'var(--red)', borderColor: s.returns>0?'rgba(224,82,82,0.4)':'' }} />
                  </Field>
                  <Field label="🎁 Бонус" labelColor="rgba(245,166,35,0.8)">
                    <input className="input" type="number" inputMode="numeric" placeholder="шт"
                      value={s.bonus||''} onChange={e => updateSaleLocal(sh.id,'bonus',parseInt(e.target.value)||0)}
                      style={{ color:'var(--accent)', borderColor: s.bonus>0?'rgba(245,166,35,0.4)':'' }} />
                  </Field>
                  <Field label="Цена (₸)">
                    <input className="input" type="number" inputMode="decimal" placeholder={sh.default_price||'₸'}
                      value={s.price||''} onChange={e => updateSaleLocal(sh.id,'price',parseFloat(e.target.value)||0)} />
                  </Field>
                </div>
                <Field label="Оплата">
                  <div style={{ display:'flex', gap:5 }}>
                    {['Наличка','Каспи'].map(pt => (
                      <button key={pt} onClick={() => updateSalePayment(sh.id, pt)}
                        style={{ flex:1, padding:'8px 4px', border:'1px solid', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer',
                          background:(s.payment_type||'Наличка')===pt?'var(--accent)':'var(--bg2)',
                          borderColor:(s.payment_type||'Наличка')===pt?'var(--accent)':'var(--border)',
                          color:(s.payment_type||'Наличка')===pt?'#000':'var(--muted)' }}>
                        {pt}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )
          })}

          {/* Итог по магазинам */}
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'12px 14px', margin:'4px 0 8px' }}>
            <Row label="Продано" value={stats.sold+' шт'} />
            <Row label="↩ Возврат" value={stats.returns+' шт'} valColor="var(--red)" />
            {totalBonus>0 && <Row label="🎁 Бонус" value={totalBonus+' шт'} valColor="var(--accent)" />}
            <div style={{ borderBottom:'1px solid var(--border)', margin:'6px 0' }} />
            <Row label="Чистые продажи" value={stats.net+' шт'} bold />
            <div style={{ borderBottom:'1px solid var(--border)', margin:'6px 0' }} />
            {activePayments.map(([type, amount]) => (
              <Row key={type} label={(type==='Наличка'?'💵':'📱')+' '+type} value={fmtMoney(amount)} />
            ))}
            <Row label="Итого выручка" value={fmtMoney(stats.revenue)} valColor="var(--accent)" bold size={15} />
          </div>
        </div>
      )}

      {/* ── TAB: РАСХОДЫ ── */}
      {tab === 'expenses' && (
        <div style={{ padding:'12px 12px 0' }}>
          {materials.length > 0 && (
            <MaterialPicker materials={materials} onAdd={addMaterialExpense} />
          )}
          {materials.length === 0 && (
            <div style={{ background:'var(--bg2)', border:'1px dashed var(--border)', borderRadius:10, padding:14, textAlign:'center', color:'var(--muted)', fontSize:13, marginBottom:12 }}>
              Добавьте материалы в Настройках → Справочник
            </div>
          )}
          {expenses.map(e => (
            <div className="card" key={e.id} style={{ borderColor:'rgba(245,131,74,0.25)', background:'rgba(245,131,74,0.04)', marginBottom:8 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input className="input" type="text" value={e.name||''} placeholder="Описание расхода"
                  onChange={ev => updateExpenseLocal(e.id,{name:ev.target.value})} style={{ flex:1.5 }} />
                <input className="input" type="number" inputMode="decimal" value={e.amount||''}
                  placeholder="₸" onChange={ev => updateExpenseLocal(e.id,{amount:parseFloat(ev.target.value)||0})} style={{ flex:1 }} />
                <button onClick={() => removeExpense(e.id)}
                  style={{ background:'none', border:'none', color:'var(--red)', fontSize:22, cursor:'pointer', padding:'0 2px', lineHeight:1 }}>×</button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div style={{ textAlign:'center', color:'var(--muted)', fontSize:13, padding:'30px 0' }}>
              Выберите материал из справочника выше
            </div>
          )}
          {expenses.length > 0 && (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', marginTop:4 }}>
              <Row label="Итого расходов" value={fmtMoney(stats.totalExpenses)} valColor="var(--red)" bold size={14} />
            </div>
          )}
        </div>
      )}

          <div style={{ height:1, background:'var(--border)', margin:'4px 0 8px' }} />

          {/* Оплата */}
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', marginBottom:8 }}>
            {activePayments.map(([type, amount]) => (
              <Row key={type} label={(type==='Наличка'?'💵':'📱')+' '+type} value={fmtMoney(amount)} />
            ))}
            <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:6 }}>
              <Row label="Итого выручка" value={fmtMoney(stats.revenue)} valColor="var(--accent)" bold size={15} />
            </div>
          </div>

          {/* По магазинам */}
          {shops.map((sh, idx) => {
            const s = sales[sh.id]
            if (!s || (!s.quantity && !s.returns)) return null
            const net = (s.quantity||0)-(s.returns||0)
            const sum = net*(s.price||0)
            return (
              <div key={sh.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>{sh.name}</span>
                  <span style={{ fontWeight:700, color:sum>=0?'var(--green)':'var(--red)' }}>{fmtMoney(sum)}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>
                  {s.quantity} шт{s.returns>0?` / ↩${s.returns}`:''}
                  {s.bonus>0?` / 🎁${s.bonus}`:''} · {s.payment_type||'Наличка'}
                </div>
              </div>
            )
          })}


    </div>
  )
}

function ProfitTile({ label, value, color, highlight }) {
  return (
    <div style={{ background:highlight?`${color}12`:'rgba(255,255,255,0.03)', border:`1px solid ${highlight?color+'30':'var(--border)'}`, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
      <div style={{ fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:800, color }}>{value}</div>
    </div>
  )
}


function Row({ label, value, valColor, bold, size }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:size||13, padding:'3px 0' }}>
      <span style={{ color:'var(--muted)' }}>{label}</span>
      <span style={{ color:valColor||'var(--text)', fontWeight:bold?700:400 }}>{value}</span>
    </div>
  )
}

function MaterialPicker({ materials, onAdd }) {
  const [selId, setSelId] = useState('')
  const [qty, setQty]     = useState(1)
  const mat = materials.find(m => m.id === selId)
  const preview = mat ? qty * mat.price_per_unit : 0

  function handleAdd() {
    if (!selId) return
    onAdd(selId, qty)
    setQty(1); setSelId('')
  }

  return (
    <div style={{ background:'rgba(245,131,74,0.04)', border:'1px solid rgba(245,131,74,0.2)', borderRadius:10, padding:10, marginBottom:8 }}>
      <div style={{ fontSize:10, color:'var(--orange)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:7 }}>Из справочника материалов</div>
      <select className="select" value={selId} onChange={e => { setSelId(e.target.value); setQty(1) }} style={{ marginBottom:8 }}>
        <option value="">Выбрать материал...</option>
        {materials.map(m => (
          <option key={m.id} value={m.id}>{m.name} — {m.price_per_unit} ₸/{m.unit}</option>
        ))}
      </select>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ fontSize:9, color:'var(--label)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, whiteSpace:'nowrap' }}>
          {mat ? mat.unit : 'Кол-во'}:
        </div>
        <div style={{ display:'flex', alignItems:'center', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <button onClick={() => setQty(q => Math.max(1, q-1))}
            style={{ background:'none', border:'none', color:'var(--text)', fontSize:18, fontWeight:700, padding:'6px 14px', cursor:'pointer', lineHeight:1 }}>−</button>
          <div style={{ minWidth:32, textAlign:'center', fontSize:15, fontWeight:800, color:'var(--text)', padding:'0 4px' }}>{qty}</div>
          <button onClick={() => setQty(q => q+1)}
            style={{ background:'none', border:'none', color:'var(--text)', fontSize:18, fontWeight:700, padding:'6px 14px', cursor:'pointer', lineHeight:1 }}>+</button>
        </div>
        <button onClick={handleAdd} disabled={!selId}
          style={{ flex:1, background:selId?'var(--orange)':'var(--bg2)', border:'none', borderRadius:8,
            color:selId?'#fff':'var(--muted)', padding:'8px 12px', fontWeight:700,
            cursor:selId?'pointer':'default', fontSize:13, whiteSpace:'nowrap' }}>
          {selId && mat ? `+ ${fmtMoney(preview)}` : 'Добавить'}
        </button>
      </div>
    </div>
  )
}

const navBtn = { background:'none', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', fontSize:18, padding:'6px 12px', cursor:'pointer' }

function Field({ label, labelColor, children }) {
  return (
    <div>
      <div className="field-label" style={labelColor?{color:labelColor}:{}}>{label}</div>
      {children}
    </div>
  )
}
