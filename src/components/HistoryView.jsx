import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { fmtDate, fmtMoney, fmtMonthLabel, calcDayIncome, calcDayExpenses } from '../utils'

export default function HistoryView() {
  const [days, setDays] = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDay, setOpenDay] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: daysData }, { data: shopsData }] = await Promise.all([
        supabase.from('days').select(`
          id, date,
          sales ( id, shop_id, quantity, price, payment_type ),
          expenses ( id, category_id, custom_label, amount, expense_categories(name) )
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
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  )

  if (days.length === 0) return (
    <div className="page">
      <div className="header">
        <div style={{ fontSize: 20, fontWeight: 800 }}>История</div>
      </div>
      <div style={{ padding: '80px 16px', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>📭</div>
        <div>Нет записей.<br />Внесите данные на вкладке «День».</div>
      </div>
    </div>
  )

  // Group by month
  const byMonth = {}
  days.forEach(d => {
    const m = d.date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(d)
  })

  return (
    <div className="page fade-in">
      <div className="header">
        <div style={{ fontSize: 20, fontWeight: 800 }}>История</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {Object.entries(byMonth).map(([month, monthDays]) => {
          const mIncome = monthDays.reduce((a, d) => a + calcDayIncome(d.sales), 0)
          const mExp = monthDays.reduce((a, d) => a + calcDayExpenses(d.expenses), 0)
          const mProfit = mIncome - mExp

          return (
            <div key={month} style={{ marginBottom: 24 }}>
              {/* Month header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: 8, padding: '0 2px'
              }}>
                <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 15 }}>
                  {fmtMonthLabel(month)}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtMoney(mIncome)}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: mProfit >= 0 ? 'var(--green)' : 'var(--red)'
                  }}>
                    {mProfit >= 0 ? '+' : ''}{fmtMoney(mProfit)}
                  </div>
                </div>
              </div>

              {monthDays.map(d => {
                const inc = calcDayIncome(d.sales)
                const exp = calcDayExpenses(d.expenses)
                const pr = inc - exp
                const isOpen = openDay === d.id

                return (
                  <div key={d.id} style={{ marginBottom: 6 }}>
                    <button
                      onClick={() => setOpenDay(isOpen ? null : d.id)}
                      style={{
                        width: '100%',
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: isOpen ? '10px 10px 0 0' : 10,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: 'var(--text)',
                        transition: 'background .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(d.date)}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {d.sales.filter(s => s.quantity > 0).length} маг.
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtMoney(inc)}</span>
                        <span style={{
                          fontSize: 14, fontWeight: 800,
                          color: pr >= 0 ? 'var(--green)' : 'var(--red)'
                        }}>
                          {fmtMoney(pr)}
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isOpen && <DayDetail day={d} shops={shops} />}
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

function DayDetail({ day, shops }) {
  const inc = calcDayIncome(day.sales)
  const exp = calcDayExpenses(day.expenses)
  const pr = inc - exp

  return (
    <div style={{
      background: '#13151e',
      border: '1px solid var(--border)',
      borderTop: 'none',
      borderRadius: '0 0 10px 10px',
      padding: '12px 14px',
    }}>
      {/* Sales */}
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Продажи
      </div>
      {day.sales.filter(s => s.quantity > 0).length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Нет данных</div>
      )}
      {day.sales.filter(s => s.quantity > 0).map(s => {
        const shop = shops.find(sh => sh.id === s.shop_id)
        const sum = s.quantity * s.price
        return (
          <div key={s.id} style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 13,
            padding: '4px 0', borderBottom: '1px solid #1e2030'
          }}>
            <span>
              {shop?.name || '—'} &mdash; {s.quantity} шт × {fmtMoney(s.price)}
              <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({s.payment_type})</span>
            </span>
            <span style={{ color: 'var(--green)', marginLeft: 8, whiteSpace: 'nowrap' }}>{fmtMoney(sum)}</span>
          </div>
        )
      })}

      {/* Expenses */}
      {day.expenses.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 6 }}>
            Расходы
          </div>
          {day.expenses.map(e => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 13,
              padding: '4px 0', borderBottom: '1px solid #1e2030'
            }}>
              <span>
                {e.expense_categories?.name || 'Прочее'}
                {e.custom_label ? ` (${e.custom_label})` : ''}
              </span>
              <span style={{ color: 'var(--red)', marginLeft: 8, whiteSpace: 'nowrap' }}>− {fmtMoney(e.amount)}</span>
            </div>
          ))}
        </>
      )}

      {/* Total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 10, paddingTop: 10,
        borderTop: '1px solid var(--border)', fontWeight: 700
      }}>
        <span>Прибыль</span>
        <span style={{ color: pr >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 15 }}>{fmtMoney(pr)}</span>
      </div>
    </div>
  )
}
