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
  const [date, setDate]           = useState(todayStr())
  const [shops, setShops]         = useState([])
  const [categories, setCategories] = useState([])
  const [dayId, setDayId]         = useState(null)
  const [sales, setSales]         = useState({})
  const [expenses, setExpenses]   = useState([])
  const [purchases, setPurchases] = useState([])
  const [salaries, setSalaries]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState({})

  useEffect(() => { onDateChange?.(date) }, [date])

  useEffect(() => {
    supabase.from('shops').select('*').order('sort_order').then(({ data }) => setShops(data || []))
    supabase.from('expense_categories').select('*').order('name').then(({ data }) => setCategories(data || []))
  }, [])

  const loadDay = useCallback(async () => {
    setLoading(true)
    let { data: day } = await supabase.from('days').select('id').eq('date', date).maybeSingle()
    if (!day) {
      const { data: nd } = await supabase.from('days').insert({ date }).select('id').single()
      day = nd
    }
    setDayId(day.id)
    const [{ data: salesData }, { data: expData }, { data: purData }, { data: salData }] = await Promise.all([
      supabase.from('sales').select('*').eq('day_id', day.id),
      supabase.from('expenses').select('*, expense_categories(name)').eq('day_id', day.id).order('created_at'),
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

  async function updateSale(shopId, field, value) {
    const cur = sales[shopId] || { quantity:0, price:0, payment_type:'Наличка', returns:0 }
    const upd = { ...cur, [field]: value }
    setSales(prev => ({ ...prev, [shopId]: upd }))
    setSaving(s => ({ ...s, [shopId]: true }))
    if (cur.id) {
      await supabase.from('sales').update({ [field]: value }).eq('id', cur.id)
    } else {
      const { data } = await supabase.from('sales').upsert({
        day_id: dayId, shop_id: shopId,
        quantity: upd.quantity || 0, price: upd.price || 0,
        payment_type: upd.payment_type || 'Наличка', returns: upd.returns || 0,
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

  const salesArr = shops.map(sh => ({ ...sales[sh.id], shop_id: sh.id }))
  const stats = calcDayStats(salesArr, expenses, purchases, salaries)
  const { byPayment } = stats

  // Only show payment types that have non-zero value
  const activePayments = Object.entries(byPayment).filter(([, v]) => v !== 0)

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  const isToday = date === todayStr()

  return (
    <div className="page fade-in">
      <div className="header">
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontWeight:700 }}>
          Рабочий день
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setDate(d => dateAdd(d, -1))} style={navBtn}>‹</button>
          <div style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:'var(--text)' }}>{dateFmt(date)}</div>
          <button onClick={() => setDate(d => dateAdd(d, 1))} style={navBtn}>›</button>
          {!isToday && (
            <button onClick={() => setDate(todayStr())} style={{ ...navBtn, borderColor:'var(--accent)', color:'var(--accent)', fontSize:11, padding:'6px 10px' }}>
              Сегодня
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:'12px 12px 0' }}>

        {/* ── SHOPS ── */}
        <SectionTitle icon="🏪" title={`Магазины (${shops.length})`} />
        {shops.map(sh => {
          const s = sales[sh.id] || {}
          const q = parseFloat(s.quantity) || 0
          const r = parseFloat(s.returns) || 0
          const p = parseFloat(s.price) || 0
          const sum = (q - r) * p
          return (
            <div className="card" key={sh.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>{sh.name}</span>
                <span style={{ color: sum > 0 ? 'var(--green)' : sum < 0 ? 'var(--red)' : 'var(--muted)', fontWeight:700, fontSize:14 }}>
                  {sum !== 0 ? fmtMoney(sum) : '—'}
                  {saving[sh.id] && <span style={{ color:'var(--muted)', fontSize:10, marginLeft:5 }}>↑</span>}
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1.1fr', gap:6 }}>
                <Field label="Продано">
                  <input className="input" type="number" inputMode="numeric" placeholder="шт"
                    value={s.quantity || ''} onChange={e => updateSale(sh.id, 'quantity', parseInt(e.target.value) || 0)} />
                </Field>
                <Field label="↩ Возврат" labelColor="rgba(224,82,82,0.8)">
                  <input className="input" type="number" inputMode="numeric" placeholder="шт"
                    value={s.returns || ''} onChange={e => updateSale(sh.id, 'returns', parseInt(e.target.value) || 0)}
                    style={{ color:'var(--red)', borderColor: s.returns > 0 ? 'rgba(224,82,82,0.4)' : '' }} />
                </Field>
                <Field label="Цена (₸)">
                  <input className="input" type="number" inputMode="decimal" placeholder="₸"
                    value={s.price || ''} onChange={e => updateSale(sh.id, 'price', parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="Оплата">
                  <select className="select" value={s.payment_type || 'Наличка'} onChange={e => updateSale(sh.id, 'payment_type', e.target.value)}>
                    <option>Наличка</option>
                    <option>Каспи</option>
                    <option>Карта</option>
                  </select>
                </Field>
              </div>
            </div>
          )
        })}

        {/* ── SALES SUMMARY ── */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'12px 14px', margin:'4px 0 8px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
            <span style={{ color:'var(--muted)' }}>Продано</span>
            <span>{stats.sold} шт</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
            <span style={{ color:'var(--red)', opacity:.8 }}>↩ Возврат</span>
            <span style={{ color:'var(--red)' }}>{stats.returns} шт</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0', borderBottom:'1px solid var(--border)', paddingBottom:8, marginBottom:8 }}>
            <span style={{ color:'var(--muted)' }}>Чистые продажи</span>
            <span style={{ fontWeight:700 }}>{stats.net} шт</span>
          </div>

          {/* Payment breakdown */}
          {activePayments.map(([type, amount]) => (
            <div key={type} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}>
              <span style={{ color:'var(--muted)' }}>
                {type === 'Наличка' ? '💵' : type === 'Каспи' ? '📱' : '💳'} {type}
              </span>
              <span style={{ color: amount >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoney(amount)}</span>
            </div>
          ))}

          {activePayments.length > 1 && (
            <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700 }}>
              <span style={{ color:'var(--muted)' }}>Итого выручка</span>
              <span style={{ color:'var(--accent)' }}>{fmtMoney(stats.revenue)}</span>
            </div>
          )}
          {activePayments.length <= 1 && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, paddingTop:4 }}>
              <span style={{ color:'var(--muted)' }}>Итого выручка</span>
              <span style={{ color:'var(--accent)' }}>{fmtMoney(stats.revenue)}</span>
            </div>
          )}
        </div>

        {/* ── PURCHASES ── */}
        <SectionTitle icon="📦" title="Закупы" onAdd={() => addListItem('purchases', setPurchases)} />
        {purchases.map(e => (
          <ListCard key={e.id} colorBg="rgba(165,123,245,0.06)" colorBorder="rgba(165,123,245,0.25)">
            <ListCardRow name={e.name} amount={e.amount} placeholder="Поставщик / товар"
              onName={v => updateListItem('purchases', setPurchases, e.id, { name: v })}
              onAmount={v => updateListItem('purchases', setPurchases, e.id, { amount: parseFloat(v) || 0 })}
              onRemove={() => removeListItem('purchases', setPurchases, e.id)} />
          </ListCard>
        ))}
        {purchases.length === 0 && <EmptyHint>Нажмите + чтобы добавить закуп</EmptyHint>}

        {/* ── EXPENSES ── */}
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

        {/* ── SALARIES ── */}
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

        {/* ── PROFIT ── */}
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
