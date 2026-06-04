import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { fmtDate, fmtMoney, fmtMonthLabel, calcDayStats } from '../utils'

export default function HistoryView() {
  const [days, setDays]   = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDay, setOpenDay] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: daysData }, { data: shopsData }] = await Promise.all([
        supabase.from('days').select(`
          id, date,
          sales ( id, shop_id, quantity, price, payment_type, returns ),
          expenses ( id, amount, name, expense_categories(name) ),
          purchases ( id, amount, name ),
          salaries ( id, amount, name )
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

  const byMonth = {}
  days.forEach(d => {
    const m = d.date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(d)
  })

  return (
    <div className="page fade-in">
      <div className="header"><div style={{ fontSize:20, fontWeight:800 }}>История</div></div>
      <div style={{ padding:'12px 12px 0' }}>
        {Object.entries(byMonth).map(([month, mDays]) => {
          const mStats = mDays.reduce((acc, d) => {
            const s = calcDayStats(d.sales, d.expenses, d.purchases, d.salaries)
            return {
              sold: acc.sold + s.sold, returns: acc.returns + s.returns,
              revenue: acc.revenue + s.revenue, profit: acc.profit + s.profit,
              totalPurchases: acc.totalPurchases + s.totalPurchases,
              totalExpenses: acc.totalExpenses + s.totalExpenses,
              totalSalaries: acc.totalSalaries + s.totalSalaries,
            }
          }, { sold:0, returns:0, revenue:0, profit:0, totalPurchases:0, totalExpenses:0, totalSalaries:0 })

          return (
            <div key={month} style={{ marginBottom:24 }}>
              {/* Month header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8, padding:'0 2px' }}>
                <span style={{ fontWeight:800, color:'var(--accent)', fontSize:15 }}>{fmtMonthLabel(month)}</span>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{fmtMoney(mStats.revenue)}</div>
                  <div style={{ fontSize:13, fontWeight:700, color: mStats.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {mStats.profit >= 0 ? '+' : ''}{fmtMoney(mStats.profit)}
                  </div>
                </div>
              </div>

              {/* Month summary */}
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:12, marginBottom:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <MonthTile label="Продано" value={`${mStats.sold} шт`} />
                  <MonthTile label="↩ Возврат" value={`${mStats.returns} шт`} color="var(--red)" />
                  <MonthTile label="Выручка" value={fmtMoney(mStats.revenue)} color="var(--blue)" />
                  <MonthTile label="Закупы" value={fmtMoney(mStats.totalPurchases)} color="var(--purple)" />
                  <MonthTile label="Расходы" value={fmtMoney(mStats.totalExpenses)} color="var(--orange)" />
                  <MonthTile label="Зарплата" value={fmtMoney(mStats.totalSalaries)} color="var(--blue)" />
                  <MonthTile label="💰 Прибыль" value={fmtMoney(mStats.profit)} color={mStats.profit >= 0 ? 'var(--accent)' : 'var(--red)'} fullWidth />
                </div>
              </div>

              {mDays.map(d => {
                const s = calcDayStats(d.sales, d.expenses, d.purchases, d.salaries)
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
      {/* Sales */}
      <Label>Продажи</Label>
      {day.sales.filter(s => s.quantity > 0 || s.returns > 0).map(s => {
        const shop = shops.find(sh => sh.id === s.shop_id)
        const net = (s.quantity||0) - (s.returns||0)
        return (
          <Row key={s.id}>
            <span>{shop?.name || '—'} — {s.quantity} шт{s.returns > 0 ? ` / ↩${s.returns}` : ''} × {fmtMoney(s.price)} <span style={{ color:'var(--muted)' }}>({s.payment_type})</span></span>
            <span style={{ color:'var(--green)', whiteSpace:'nowrap', marginLeft:8 }}>{fmtMoney(net * s.price)}</span>
          </Row>
        )
      })}
      {/* Purchases */}
      {day.purchases?.length > 0 && <>
        <Label style={{ marginTop:8 }}>Закупы</Label>
        {day.purchases.map(e => <Row key={e.id}><span style={{ color:'var(--purple)' }}>{e.name||'—'}</span><span style={{ color:'var(--red)', whiteSpace:'nowrap', marginLeft:8 }}>− {fmtMoney(e.amount)}</span></Row>)}
      </>}
      {/* Expenses */}
      {day.expenses?.length > 0 && <>
        <Label style={{ marginTop:8 }}>Расходы</Label>
        {day.expenses.map(e => <Row key={e.id}><span style={{ color:'var(--orange)' }}>{e.name || e.expense_categories?.name || '—'}</span><span style={{ color:'var(--red)', whiteSpace:'nowrap', marginLeft:8 }}>− {fmtMoney(e.amount)}</span></Row>)}
      </>}
      {/* Salaries */}
      {day.salaries?.length > 0 && <>
        <Label style={{ marginTop:8 }}>Зарплата</Label>
        {day.salaries.map(e => <Row key={e.id}><span style={{ color:'var(--blue)' }}>{e.name||'—'}</span><span style={{ color:'var(--red)', whiteSpace:'nowrap', marginLeft:8 }}>− {fmtMoney(e.amount)}</span></Row>)}
      </>}
      {/* Total */}
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
