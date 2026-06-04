import { useState, useEffect, useCallback } from 'react'
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
  const [date, setDate]             = useState(todayStr())
  const [shops, setShops]           = useState([])
  const [materials, setMaterials]   = useState([])
  const [dayId, setDayId]           = useState(null)
  const [baked, setBaked]           = useState(0)
  const [showBakedModal, setShowBakedModal] = useState(false)
  const [bakedInput, setBakedInput] = useState('')
  const [sales, setSales]           = useState({})
  const [expenses, setExpenses]     = useState([])
  const [purchases, setPurchases]   = useState([])
  const [salaries, setSalaries]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState({})

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
    const dayBaked = day.baked || 0
    setBaked(dayBaked)
    if (!dayBaked) { setBakedInput(''); setShowBakedModal(true) }
    else setShowBakedModal(false)

    const [{ data: salesData }, { data: expData }, { data: purData }, { data: salData }] = await Promise.all([
      supabase.from('sales').select('*').eq('day_id', day.id),
      supabase.from('expenses').select('*').eq('day_id', day.id).order('created_at'),
      supabase.from('purchases').select('*').eq('day_id', day.id).order('created_at'),
      supabase.from('salaries').select('*').eq('day_id', day.id).order('created_at'),
    ])
    const map = {}
    ;(salesData || []).forEach(s => { map[s.shop_id] = s })
    setSales(map)
    setExpenses(expData || [])
    setPurchases(purData || [])
    setSalaries(salData || [])
    setLoading(false)
  }, [date])

  useEffect(() => { loadDay() }, [loadDay])

  async function saveBaked() {
    const val = parseInt(bakedInput) || 0
    if (!val) return
    setBaked(val); setShowBakedModal(false)
    await supabase.from('days').update({ baked: val }).eq('id', dayId)
  }

  async function updateSale(shopId, field, value) {
    const shop = shops.find(s => s.id === shopId)
    const cur = sales[shopId] || { quantity:0, price: shop?.default_price || 0, payment_type:'Наличка', returns:0, bonus:0 }
    const upd = { ...cur, [field]: value }
    setSales(prev => ({ ...prev, [shopId]: upd }))
    setSaving(s => ({ ...s, [shopId]: true }))
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
    setSaving(s => ({ ...s, [shopId]: false }))
  }

  async function addListItem(table, setter, extra = {}) {
    const { data } = await supabase.from(table).insert({ day_id: dayId, name:'', amount:0, ...extra }).select().single()
    if (data) setter(prev => [...prev, data])
  }
  async function updateListItem(table, setter, id, fields) {
    setter(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e))
    await supabase.from(table).update(fields).eq('id', id)
  }
  async function removeListItem(table, setter, id) {
    setter(prev => prev.filter(e => e.id !== id))
    await supabase.from(table).delete().eq('id', id)
  }

  // Добавить расход из справочника
  async function addMaterialExpense(matId, qty) {
    const mat = materials.find(m => m.id === matId)
    if (!mat) return
    const amount = (parseFloat(qty) || 1) * (mat.price_per_unit || 0)
    const name = `${mat.name} × ${qty} ${mat.unit}`
    const { data } = await supabase.from('purchases').insert({ day_id: dayId, name, amount, material_id: matId, qty: parseFloat(qty) || 1 }).select().single()
    if (data) setPurchases(prev => [...prev, data])
  }

  const salesArr = shops.map(sh => ({ ...sales[sh.id], shop_id: sh.id }))
  const stats = calcDayStats(salesArr, expenses, purchases, salaries)
  const { byPayment } = stats
  const activePayments = Object.entries(byPayment).filter(([, v]) => v !== 0)
  const totalBonus = shops.reduce((a, sh) => a + (parseInt(sales[sh.id]?.bonus) || 0), 0)
  const remaining = Math.max(0, baked - stats.net - totalBonus)
  const progressPct = baked > 0 ? Math.min(100, Math.round(((stats.net + totalBonus) / baked) * 100)) : 0

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  const isToday = date === todayStr()

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

      {/* Topbar */}
      <div className="header">
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontWeight:700 }}>Рабочий день</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setDate(d => dateAdd(d, -1))} style={navBtn}>‹</button>
          <div style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:'var(--text)' }}>{dateFmt(date)}</div>
          <button onClick={() => setDate(d => dateAdd(d, 1))} style={navBtn}>›</button>
          {!isToday && (
            <button onClick={() => setDate(todayStr())} style={{ ...navBtn, borderColor:'var(--accent)', color:'var(--accent)', fontSize:11, padding:'6px 10px' }}>Сегодня</button>
          )}
        </div>

        {/* Прогресс-бар */}
        {baked > 0 && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>
                🥖 Продано: <span style={{ color:'var(--green)', fontWeight:800 }}>{stats.net}</span>
                {totalBonus > 0 && <span style={{ color:'var(--accent)' }}> + 🎁{totalBonus}</span>}
                {' '}из <span style={{ color:'var(--text)' }}>{baked}</span> шт
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:11, color: remaining > 0 ? 'var(--accent)' : 'var(--green)', fontWeight:700 }}>
                  {remaining > 0 ? `остаток: ${remaining} шт` : '✓ всё'}
                </span>
                <button onClick={() => { setBakedInput(String(baked)); setShowBakedModal(true) }}
                  style={{ background:'none', border:'none', color:'var(--muted)', fontSize:13, cursor:'pointer', padding:'0 2px' }}>✏️</button>
              </div>
            </div>
            <div style={{ background:'var(--border)', borderRadius:4, height:5 }}>
              <div style={{ width: progressPct+'%', height:5, borderRadius:4, background: progressPct >= 100 ? 'var(--green)' : 'var(--accent)', transition:'width .3s ease', minWidth: progressPct > 0 ? 4 : 0 }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:'12px 12px 0' }}>

        {/* ── SHOPS ── */}
        <SectionTitle icon="🏪" title={`Магазины (${shops.length})`} />
        {shops.map(sh => {
          const s = sales[sh.id] || {}
          const q = parseFloat(s.quantity) || 0
          const r = parseFloat(s.returns) || 0
          const b = parseInt(s.bonus) || 0
          const p = parseFloat(s.price) || parseFloat(sh.default_price) || 0
          const sum = (q - r) * p
          return (
            <div className="card" key={sh.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>{sh.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {b > 0 && <span style={{ fontSize:11, color:'var(--accent)' }}>🎁 {b} шт</span>}
                  <span style={{ color: sum > 0 ? 'var(--green)' : sum < 0 ? 'var(--red)' : 'var(--muted)', fontWeight:700, fontSize:14 }}>
                    {sum !== 0 ? fmtMoney(sum) : '—'}
                    {saving[sh.id] && <span style={{ color:'var(--muted)', fontSize:10, marginLeft:5 }}>↑</span>}
                  </span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginBottom: 6 }}>
                <Field label="Продано">
                  <input className="input" type="number" inputMode="numeric" placeholder="шт"
                    value={s.quantity || ''} onChange={e => updateSale(sh.id, 'quantity', parseInt(e.target.value) || 0)} />
                </Field>
                <Field label="↩ Возврат" labelColor="rgba(224,82,82,0.8)">
                  <input className="input" type="number" inputMode="numeric" placeholder="шт"
                    value={s.returns || ''} onChange={e => updateSale(sh.id, 'returns', parseInt(e.target.value) || 0)}
                    style={{ color:'var(--red)', borderColor: s.returns > 0 ? 'rgba(224,82,82,0.4)' : '' }} />
                </Field>
                <Field label="🎁 Бонус" labelColor="rgba(245,166,35,0.8)">
                  <input className="input" type="number" inputMode="numeric" placeholder="шт"
                    value={s.bonus || ''} onChange={e => updateSale(sh.id, 'bonus', parseInt(e.target.value) || 0)}
                    style={{ color:'var(--accent)', borderColor: s.bonus > 0 ? 'rgba(245,166,35,0.4)' : '' }} />
                </Field>
                <Field label="Цена (₸)">
                  <input className="input" type="number" inputMode="decimal" placeholder={sh.default_price || '₸'}
                    value={s.price || ''} onChange={e => updateSale(sh.id, 'price', parseFloat(e.target.value) || 0)} />
                </Field>
              </div>
              <Field label="Оплата">
                <div style={{ display:'flex', gap:5 }}>
                  {['Наличка','Каспи'].map(pt => (
                    <button key={pt} onClick={() => updateSale(sh.id, 'payment_type', pt)}
                      style={{ flex:1, padding:'6px 4px', border:'1px solid', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer',
                        background: (s.payment_type||'Наличка')===pt ? 'var(--accent)' : 'var(--bg2)',
                        borderColor: (s.payment_type||'Наличка')===pt ? 'var(--accent)' : 'var(--border)',
                        color: (s.payment_type||'Наличка')===pt ? '#000' : 'var(--muted)' }}>
                      {pt}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )
        })}

        {/* ── SALES SUMMARY ── */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'12px 14px', margin:'4px 0 8px' }}>
          <div className="row-s"><span style={{ color:'var(--muted)' }}>Продано</span><span>{stats.sold} шт</span></div>
          <div className="row-s"><span style={{ color:'var(--red)', opacity:.8 }}>↩ Возврат</span><span style={{ color:'var(--red)' }}>{stats.returns} шт</span></div>
          {totalBonus > 0 && <div className="row-s"><span style={{ color:'var(--accent)', opacity:.8 }}>🎁 Бонус</span><span style={{ color:'var(--accent)' }}>{totalBonus} шт</span></div>}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0', borderBottom:'1px solid var(--border)', paddingBottom:8, marginBottom:8 }}>
            <span style={{ color:'var(--muted)' }}>Чистые продажи</span>
            <span style={{ fontWeight:700 }}>{stats.net} шт</span>
          </div>
          {activePayments.map(([type, amount]) => (
            <div key={type} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
              <span style={{ color:'var(--muted)' }}>{type==='Наличка'?'💵':type==='Каспи'?'📱':'💳'} {type}</span>
              <span style={{ color: amount >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoney(amount)}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700 }}>
            <span style={{ color:'var(--muted)' }}>Итого выручка</span>
            <span style={{ color:'var(--accent)' }}>{fmtMoney(stats.revenue)}</span>
          </div>
        </div>

        {/* ── ЗАКУПЫ из справочника ── */}
        <SectionTitle icon="📦" title="Закупы" onAdd={() => addListItem('purchases', setPurchases)} />
        {materials.length > 0 && (
          <MaterialPicker materials={materials} onAdd={addMaterialExpense} />
        )}
        {purchases.map(e => (
          <ListCard key={e.id} colorBg="rgba(165,123,245,0.06)" colorBorder="rgba(165,123,245,0.25)">
            <ListCardRow name={e.name} amount={e.amount} placeholder="Поставщик / товар"
              onName={v => updateListItem('purchases', setPurchases, e.id, { name: v })}
              onAmount={v => updateListItem('purchases', setPurchases, e.id, { amount: parseFloat(v) || 0 })}
              onRemove={() => removeListItem('purchases', setPurchases, e.id)} />
          </ListCard>
        ))}
        {purchases.length === 0 && <EmptyHint>Нажмите + или выберите из справочника</EmptyHint>}

        {/* ── РАСХОДЫ ── */}
        <SectionTitle icon="💸" title="Расходы" onAdd={() => addListItem('expenses', setExpenses)} />
        {expenses.map(e => (
          <ListCard key={e.id} colorBg="rgba(245,131,74,0.06)" colorBorder="rgba(245,131,74,0.25)">
            <ListCardRow name={e.name || ''} amount={e.amount} placeholder="Описание расхода"
              onName={v => updateListItem('expenses', setExpenses, e.id, { name: v })}
              onAmount={v => updateListItem('expenses', setExpenses, e.id, { amount: parseFloat(v) || 0 })}
              onRemove={() => removeListItem('expenses', setExpenses, e.id)} />
          </ListCard>
        ))}
        {expenses.length === 0 && <EmptyHint>Нажмите + чтобы добавить расход</EmptyHint>}

        {/* ── ЗАРПЛАТА ── */}
        <SectionTitle icon="👷" title="Зарплата" onAdd={() => addListItem('salaries', setSalaries)} />
        {salaries.map(e => (
          <ListCard key={e.id} colorBg="rgba(91,138,245,0.06)" colorBorder="rgba(91,138,245,0.25)">
            <ListCardRow name={e.name} amount={e.amount} placeholder="Имя рабочего"
              onName={v => updateListItem('salaries', setSalaries, e.id, { name: v })}
              onAmount={v => updateListItem('salaries', setSalaries, e.id, { amount: parseFloat(v) || 0 })}
              onRemove={() => removeListItem('salaries', setSalaries, e.id)} />
          </ListCard>
        ))}
        {salaries.length === 0 && <EmptyHint>Нажмите + чтобы добавить зарплату</EmptyHint>}

        {/* ── ПРИБЫЛЬ ── */}
        <div className={`profit-card ${stats.profit >= 0 ? 'positive' : 'negative'}`} style={{ marginTop:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
            <span style={{ color:'var(--muted)' }}>Выручка</span><span>{fmtMoney(stats.revenue)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
            <span style={{ color:'var(--purple)', opacity:.8 }}>📦 Закупы</span>
            <span style={{ color:'var(--red)' }}>− {fmtMoney(stats.totalPurchases)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
            <span style={{ color:'var(--orange)', opacity:.8 }}>💸 Расходы</span>
            <span style={{ color:'var(--red)' }}>− {fmtMoney(stats.totalExpenses)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
            <span style={{ color:'var(--blue)', opacity:.8 }}>👷 Зарплата</span>
            <span style={{ color:'var(--red)' }}>− {fmtMoney(stats.totalSalaries)}</span>
          </div>
          <div style={{ borderTop:`1px solid ${stats.profit >= 0 ? '#22543d' : '#7f1d1d'}`, marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, fontSize:15 }}>Чистая прибыль</span>
            <span style={{ color: stats.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:800, fontSize:18 }}>
              {fmtMoney(stats.profit)}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

// Быстрый выбор из справочника
function MaterialPicker({ materials, onAdd }) {
  const [selId, setSelId] = useState('')
  const [qty, setQty]     = useState('1')
  const mat = materials.find(m => m.id === selId)
  const preview = mat ? (parseFloat(qty) || 1) * mat.price_per_unit : 0

  function handleAdd() {
    if (!selId || !qty) return
    onAdd(selId, qty)
    setQty('1'); setSelId('')
  }

  return (
    <div style={{ background:'rgba(165,123,245,0.04)', border:'1px solid rgba(165,123,245,0.2)', borderRadius:10, padding:10, marginBottom:8 }}>
      <div style={{ fontSize:10, color:'var(--purple)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:7 }}>Быстрый выбор из справочника</div>
      <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
        <div style={{ flex:2 }}>
          <div style={{ fontSize:9, color:'var(--label)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:3 }}>Материал</div>
          <select className="select" value={selId} onChange={e => setSelId(e.target.value)}>
            <option value="">Выбрать...</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.price_per_unit} ₸/{m.unit})</option>
            ))}
          </select>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:'var(--label)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:3 }}>Кол-во</div>
          <input className="input" type="number" inputMode="decimal" value={qty}
            onChange={e => setQty(e.target.value)} placeholder="1" />
        </div>
        <button onClick={handleAdd} disabled={!selId}
          style={{ background: selId ? 'var(--purple)' : 'var(--bg2)', border:'none', borderRadius:8, color: selId ? '#fff' : 'var(--muted)', padding:'8px 12px', fontWeight:700, cursor: selId ? 'pointer' : 'default', fontSize:13, whiteSpace:'nowrap' }}>
          + {selId && mat ? fmtMoney(preview) : 'Добавить'}
        </button>
      </div>
    </div>
  )
}

const navBtn = { background:'none', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', fontSize:18, padding:'6px 12px', cursor:'pointer' }

function SectionTitle({ icon, title, onAdd }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:20, marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:'var(--muted)' }}>
        <span>{icon}</span>{title}
      </div>
      {onAdd && (
        <button onClick={onAdd} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', fontSize:18, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
      )}
    </div>
  )
}
function Field({ label, labelColor, children }) {
  return (
    <div>
      <div className="field-label" style={labelColor ? { color: labelColor } : {}}>{label}</div>
      {children}
    </div>
  )
}
function ListCard({ children, colorBg, colorBorder }) {
  return (
    <div className="card" style={{ borderColor: colorBorder, background: colorBg, marginBottom:8 }}>
      {children}
    </div>
  )
}
function ListCardRow({ name, amount, placeholder, onName, onAmount, onRemove }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      <input className="input" type="text" value={name || ''} placeholder={placeholder}
        onChange={e => onName(e.target.value)} style={{ flex:1.5 }} />
      <input className="input" type="number" inputMode="decimal" value={amount || ''}
        placeholder="₸" onChange={e => onAmount(e.target.value)} style={{ flex:1 }} />
      <button onClick={onRemove} style={{ background:'none', border:'none', color:'var(--red)', fontSize:22, cursor:'pointer', padding:'0 2px', lineHeight:1 }}>×</button>
    </div>
  )
}
function EmptyHint({ children }) {
  return <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12, padding:'6px 0 2px' }}>{children}</div>
}
