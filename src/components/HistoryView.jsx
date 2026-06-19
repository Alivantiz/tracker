import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { fmtDate, fmtMoney, fmtMonthLabel, calcDayStats } from '../utils'

export default function HistoryView() {
  const [days, setDays]     = useState([])
  const [shops, setShops]   = useState([])
  const [loading, setLoading] = useState(true)
  const [openDay, setOpenDay] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: daysData }, { data: shopsData }] = await Promise.all([
        supabase.from('days').select(`
          id, date,
          sales ( id, shop_id, quantity, price, payment_type, returns, bonus ),
          expenses ( id, amount, name, category )
        `).order('date', { ascending: false }),
        supabase.from('shops').select('*').order('sort_order'),
      ])
      setDays(daysData || [])
      setShops(shopsData || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  if (days.length === 0) return (
    <div className="page">
      <div className="header"><div style={{ fontSize:20, fontWeight:800 }}>История</div></div>
      <div style={{ padding:'80px 16px', textAlign:'center', color:'var(--muted)' }}>
        <div style={{ fontSize:52, marginBottom:12 }}>📭</div>
        Нет записей.<br />Внесите данные на вкладке «День».
      </div>
    </div>
  )

  // Фильтр по диапазону дат
  const filtered = days.filter(d => {
    if (dateFrom && d.date < dateFrom) return false
    if (dateTo && d.date > dateTo) return false
    return true
  })

  const byMonth = {}
  filtered.forEach(d => {
    const m = d.date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(d)
  })

  function clearFilter() { setDateFrom(''); setDateTo('') }

  return (
    <div className="page fade-in">
      <div className="header">
        <div style={{ fontSize:20, fontWeight:800, marginBottom:10 }}>История</div>

        {/* Фильтр диапазона */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:3 }}>С</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width:'100%', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', padding:'8px 10px', fontSize:13 }} />
          </div>
          <div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:3 }}>По</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width:'100%', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', padding:'8px 10px', fontSize:13 }} />
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={clearFilter} style={{ marginTop:8, width:'100%', background:'none', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', padding:'6px', fontSize:12, cursor:'pointer', fontWeight:700 }}>
            ✕ Сбросить фильтр
          </button>
        )}
      </div>

      <div style={{ padding:'12px 12px 0' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', color:'var(--muted)', padding:'60px 0', fontSize:14 }}>
            Нет записей за выбранный период
          </div>
        )}

        {Object.entries(byMonth).map(([month, mDays]) => {
          const mStats = mDays.reduce((acc, d) => {
            const s = calcDayStats(d.sales, d.expenses, [], [])
            const purchases = (d.expenses||[]).filter(e=>(e.category||'💸 Расходы')==='📦 Закупы').reduce((a,e)=>a+(e.amount||0),0)
            const expenses2 = (d.expenses||[]).filter(e=>(e.category||'💸 Расходы')==='💸 Расходы').reduce((a,e)=>a+(e.amount||0),0)
            const salaries  = (d.expenses||[]).filter(e=>(e.category||'💸 Расходы')==='👷 Зарплата').reduce((a,e)=>a+(e.amount||0),0)
            return {
              sold: acc.sold + s.sold,
              returns: acc.returns + s.returns,
              revenue: acc.revenue + s.revenue,
              profit: acc.profit + s.profit,
              totalExpenses: acc.totalExpenses + s.totalExpenses,
              totalPurchases: acc.totalPurchases + purchases,
              totalExpenses2: acc.totalExpenses2 + expenses2,
              totalSalaries: acc.totalSalaries + salaries,
            }
          }, { sold:0, returns:0, revenue:0, profit:0, totalExpenses:0, totalPurchases:0, totalExpenses2:0, totalSalaries:0 })

          return (
            <div key={month} style={{ marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8, padding:'0 2px' }}>
                <span style={{ fontWeight:800, color:'var(--accent)', fontSize:15 }}>{fmtMonthLabel(month)}</span>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{fmtMoney(mStats.revenue)}</div>
                  <div style={{ fontSize:13, fontWeight:700, color: mStats.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {mStats.profit >= 0 ? '+' : ''}{fmtMoney(mStats.profit)}
                  </div>
                </div>
              </div>

              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:12, marginBottom:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <MonthTile label="Продано"     value={`${mStats.sold} шт`} />
                  <MonthTile label="↩ Возврат"   value={`${mStats.returns} шт`} color="var(--red)" />
                  <MonthTile label="Выручка"     value={fmtMoney(mStats.revenue)} color="var(--blue)" />
                  <MonthTile label="📦 Закупы"   value={fmtMoney(mStats.totalPurchases)} color="var(--purple)" />
                  <MonthTile label="💸 Расходы"  value={fmtMoney(mStats.totalExpenses2)} color="var(--orange)" />
                  <MonthTile label="👷 Зарплата"   value={fmtMoney(mStats.totalSalaries)} color="var(--blue)" />
                  <MonthTile label="Итого затраты" value={fmtMoney(mStats.totalPurchases+mStats.totalExpenses2+mStats.totalSalaries)} color="var(--red)" />
                  <MonthTile label="💰 Прибыль"  value={fmtMoney(mStats.profit)} color={mStats.profit >= 0 ? 'var(--accent)' : 'var(--red)'} fullWidth />
                </div>
              </div>

              {mDays.map(d => {
                const s = calcDayStats(d.sales, d.expenses, [], [])
                const isOpen = openDay === d.id
                return (
                  <div key={d.id} style={{ marginBottom:6 }}>
                    <button onClick={() => setOpenDay(isOpen ? null : d.id)} style={{
                      width:'100%', background:'var(--bg2)', border:'1px solid var(--border)',
                      borderRadius: isOpen ? '10px 10px 0 0' : 10, padding:'12px 14px',
                      cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', color:'var(--text)'
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:15, fontWeight:700 }}>{fmtDate(d.date)}</span>
                        <span style={{ fontSize:11, color:'var(--muted)' }}>{s.net} шт</span>
                      </div>
                      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                        <span style={{ fontSize:12, color:'var(--muted)' }}>{fmtMoney(s.revenue)}</span>
                        <span style={{ fontSize:14, fontWeight:800, color: s.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmtMoney(s.profit)}
                        </span>
                        <span style={{ color:'var(--muted)', fontSize:11 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {isOpen && <DayDetail day={d} shops={shops} stats={s} />}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayDetail({ day, shops, stats }) {
  return (
    <div style={{ background:'#13151e', border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'12px 14px' }}>
      <Label>Продажи</Label>
      {day.sales.filter(s => s.quantity > 0 || s.returns > 0).map(s => {
        const shop = shops.find(sh => sh.id === s.shop_id)
        const net = (s.quantity||0) - (s.returns||0)
        return (
          <Row key={s.id}>
            <span>
              {shop?.name || '—'} — {s.quantity} шт
              {s.returns > 0 ? ` / ↩${s.returns}` : ''}
              {s.bonus > 0 ? ` / 🎁${s.bonus}` : ''}
              {' '}× {fmtMoney(s.price)} <span style={{ color:'var(--muted)' }}>({s.payment_type})</span>
            </span>
            <span style={{ color:'var(--green)', whiteSpace:'nowrap', marginLeft:8 }}>{fmtMoney(net * s.price)}</span>
          </Row>
        )
      })}
      {day.expenses?.length > 0 && (() => {
        const cats = ['📦 Закупы','💸 Расходы','👷 Зарплата']
        const catColor = { '📦 Закупы':'var(--purple)','💸 Расходы':'var(--orange)','👷 Зарплата':'var(--blue)' }
        return cats.map(cat => {
          const items = day.expenses.filter(e => (e.category||'💸 Расходы') === cat)
          if (!items.length) return null
          return (
            <div key={cat}>
              <Label style={{ marginTop:8 }}>{cat}</Label>
              {items.map(e => (
                <Row key={e.id}>
                  <span style={{ color:catColor[cat] }}>{e.name||'—'}</span>
                  <span style={{ color:'var(--red)', whiteSpace:'nowrap', marginLeft:8 }}>− {fmtMoney(e.amount)}</span>
                </Row>
              ))}
            </div>
          )
        })
      })()}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)', fontWeight:700 }}>
        <span>Прибыль</span>
        <span style={{ color: stats.profit >= 0 ? 'var(--green)' : 'var(--red)', fontSize:15 }}>{fmtMoney(stats.profit)}</span>
      </div>
    </div>
  )
}

function Label({ children, style }) {
  return <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:5, marginTop:4, ...style }}>{children}</div>
}
function Row({ children }) {
  return <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0', borderBottom:'1px solid #1e2030' }}>{children}</div>
}
function MonthTile({ label, value, color, fullWidth }) {
  return (
    <div style={{ background:'var(--bg)', borderRadius:8, padding:'5px 8px', gridColumn: fullWidth ? '1/-1' : undefined }}>
      <div style={{ fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}
