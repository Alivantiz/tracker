import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { todayStr, fmtMoney, fmtDate, calcDayStats } from '../utils'

const PAY_ICON   = { 'Наличка':'💵', 'Каспи':'📱', 'Карта':'💳' }
const PAY_COLOR  = { 'Наличка':'var(--green)', 'Каспи':'var(--blue)', 'Карта':'var(--purple)' }
const PAY_BG     = { 'Наличка':'rgba(76,175,125,0.06)', 'Каспи':'rgba(91,138,245,0.06)', 'Карта':'rgba(165,123,245,0.06)' }
const PAY_BORDER = { 'Наличка':'rgba(76,175,125,0.3)', 'Каспи':'rgba(91,138,245,0.3)', 'Карта':'rgba(165,123,245,0.3)' }

export default function TotalsView({ date }) {
  const d = date || todayStr()
  const [data, setData]     = useState(null)
  const [shops, setShops]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: shopsData }, { data: day }] = await Promise.all([
        supabase.from('shops').select('*').order('sort_order'),
        supabase.from('days').select('id').eq('date', d).maybeSingle(),
      ])
      setShops(shopsData || [])
      if (!day) { setData(null); setLoading(false); return }

      const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase.from('sales').select('*').eq('day_id', day.id),
        supabase.from('expenses').select('*').eq('day_id', day.id),
      ])
      setData({ sales: sales||[], expenses: expenses||[] })
      setLoading(false)
    }
    load()
  }, [d])

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  // Разбивка расходов по категориям
  const purchases = data?.expenses.filter(e => (e.category||'💸 Расходы') === '📦 Закупы') || []
  const expenses2 = data?.expenses.filter(e => (e.category||'💸 Расходы') === '💸 Расходы') || []
  const salaries  = data?.expenses.filter(e => (e.category||'💸 Расходы') === '👷 Зарплата') || []

  const totalPurchases = purchases.reduce((a,e) => a+(e.amount||0), 0)
  const totalExpenses2 = expenses2.reduce((a,e) => a+(e.amount||0), 0)
  const totalSalaries  = salaries.reduce((a,e) => a+(e.amount||0), 0)

  const stats = data ? calcDayStats(data.sales, data.expenses, [], []) : null
  const activePayments = stats ? Object.entries(stats.byPayment).filter(([, v]) => v !== 0) : []

  return (
    <div className="page fade-in">
      <div className="header">
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:4, fontWeight:700 }}>Итоги дня</div>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--accent)' }}>{fmtDate(d)}</div>
      </div>

      <div style={{ padding:'12px 12px 80px' }}>
        {!stats ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'var(--muted)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
            Нет данных за этот день.<br />Перейдите на вкладку «День».
          </div>
        ) : (
          <>
            {/* Штуки */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <Tile label="Продано"       value={`${stats.sold} шт`} />
              <Tile label="↩ Возврат"    value={`${stats.returns} шт`} color="var(--red)" border="rgba(224,82,82,0.3)" bg="rgba(224,82,82,0.06)" />
              <Tile label="Чистые продажи" value={`${stats.net} шт`} color="var(--green)" border="rgba(76,175,125,0.3)" bg="rgba(76,175,125,0.06)" fullWidth />
            </div>

            <Divider />

            {/* Выручка по оплате */}
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:8 }}>💰 Выручка по оплате</div>
            <div style={{ display:'grid', gridTemplateColumns: activePayments.length === 1 ? '1fr' : '1fr 1fr', gap:8, marginBottom:8 }}>
              {activePayments.map(([type, amount]) => (
                <Tile key={type}
                  label={`${PAY_ICON[type]||'💰'} ${type}`}
                  value={fmtMoney(amount)}
                  color={amount>=0?(PAY_COLOR[type]||'var(--text)'):'var(--red)'}
                  border={amount>=0?(PAY_BORDER[type]||'var(--border)'):'rgba(224,82,82,0.3)'}
                  bg={PAY_BG[type]||'var(--bg2)'} />
              ))}
              {activePayments.length > 1 && (
                <Tile label="Итого выручка" value={fmtMoney(stats.revenue)} color="var(--accent)" border="var(--accent)" bg="rgba(245,166,35,0.08)" fullWidth />
              )}
              {activePayments.length <= 1 && (
                <Tile label="Итого выручка" value={fmtMoney(stats.revenue)} color="var(--accent)" border="var(--accent)" bg="rgba(245,166,35,0.08)" fullWidth={activePayments.length===0} />
              )}
            </div>

            <Divider />

            {/* Затраты по категориям */}
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:8 }}>📉 Затраты</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <Tile label="📦 Закупы"   value={fmtMoney(totalPurchases)} color="var(--purple)" border="rgba(165,123,245,0.3)" bg="rgba(165,123,245,0.06)" />
              <Tile label="💸 Расходы"  value={fmtMoney(totalExpenses2)} color="var(--orange)" border="rgba(245,131,74,0.3)"  bg="rgba(245,131,74,0.06)" />
              <Tile label="👷 Зарплата" value={fmtMoney(totalSalaries)}  color="var(--blue)"   border="rgba(91,138,245,0.3)"  bg="rgba(91,138,245,0.06)" fullWidth />
            </div>

            <Divider />

            {/* Прибыль */}
            <div style={{
              background: stats.profit>=0?'rgba(76,175,125,0.08)':'rgba(224,82,82,0.06)',
              border:`1px solid ${stats.profit>=0?'var(--green)':'rgba(224,82,82,0.4)'}`,
              borderRadius:14, padding:16, textAlign:'center', marginBottom:16
            }}>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:6 }}>💰 Чистая прибыль</div>
              <div style={{ fontSize:32, fontWeight:800, color: stats.profit>=0?'var(--accent)':'var(--red)' }}>
                {fmtMoney(stats.profit)}
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>
                {fmtMoney(stats.revenue)} − {fmtMoney(stats.totalCosts)}
              </div>
            </div>

            {/* По магазинам */}
            {data.sales.some(s => s.quantity>0||s.returns>0) && (
              <>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:8 }}>🏪 По магазинам</div>
                {shops.map(sh => {
                  const s = data.sales.find(x => x.shop_id===sh.id)
                  if (!s||(!s.quantity&&!s.returns)) return null
                  const net = (s.quantity||0)-(s.returns||0)
                  const sum = net*(s.price||0)
                  const pt = s.payment_type||'Наличка'
                  return (
                    <div className="card" key={sh.id} style={{ marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontWeight:700, fontSize:14 }}>{sh.name}</span>
                        <span style={{ fontSize:12, color:'var(--muted)' }}>{PAY_ICON[pt]||'💰'} {pt}</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                        <MiniStat label="Продано"   value={`${s.quantity||0} шт`} />
                        <MiniStat label="↩ Возврат" value={`${s.returns||0} шт`} color="var(--red)" />
                        <MiniStat label="Сумма"     value={fmtMoney(sum)} color={sum>=0?'var(--green)':'var(--red)'} />
                      </div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>
                        Цена: {fmtMoney(s.price)} · Чистых: {net} шт
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {purchases.length > 0 && <DetailList title="📦 Закупы"   items={purchases} color="var(--purple)" />}
            {expenses2.length > 0 && <DetailList title="💸 Расходы"  items={expenses2} color="var(--orange)" />}
            {salaries.length  > 0 && <DetailList title="👷 Зарплата" items={salaries}  color="var(--blue)"   />}
          </>
        )}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height:1, background:'var(--border)', margin:'4px 0 12px' }} />
}
function Tile({ label, value, color, border, bg, fullWidth }) {
  return (
    <div style={{ background:bg||'var(--bg2)', border:`1px solid ${border||'var(--border)'}`, borderRadius:10, padding:'10px 12px', gridColumn:fullWidth?'1/-1':undefined }}>
      <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color:color||'var(--text)' }}>{value}</div>
    </div>
  )
}
function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color:color||'var(--text)' }}>{value}</div>
    </div>
  )
}
function DetailList({ title, items, color }) {
  const f = items.filter(x => x.name||x.amount)
  if (!f.length) return null
  return (
    <>
      <Divider />
      <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:8 }}>{title}</div>
      <div className="card" style={{ marginBottom:8 }}>
        {f.map((x,i) => (
          <div key={x.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:i<f.length-1?'1px solid var(--border)':'none', fontSize:13 }}>
            <span style={{ color }}>{x.name||'—'}</span>
            <span style={{ fontWeight:700 }}>{fmtMoney(x.amount)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
