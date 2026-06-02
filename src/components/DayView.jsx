import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { todayStr, fmtDate, fmtMoney, calcDayIncome, calcDayExpenses } from '../utils'

export default function DayView() {
  const [date, setDate] = useState(todayStr())
  const [shops, setShops] = useState([])
  const [categories, setCategories] = useState([])
  const [dayId, setDayId] = useState(null)
  const [sales, setSales] = useState({})       // { shopId: { quantity, price, payment_type, id } }
  const [expenses, setExpenses] = useState([]) // [{ id, category_id, custom_label, amount }]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  // Load shops & categories once
  useEffect(() => {
    async function init() {
      const [{ data: sh }, { data: cats }] = await Promise.all([
        supabase.from('shops').select('*').order('sort_order'),
        supabase.from('expense_categories').select('*').order('name'),
      ])
      setShops(sh || [])
      setCategories(cats || [])
    }
    init()
  }, [])

  // Load day data when date changes
  const loadDay = useCallback(async () => {
    setLoading(true)
    // Get or create day
    let { data: day } = await supabase.from('days').select('id').eq('date', date).maybeSingle()
    if (!day) {
      const { data: newDay } = await supabase.from('days').insert({ date }).select('id').single()
      day = newDay
    }
    setDayId(day.id)

    // Load sales
    const { data: salesData } = await supabase.from('sales')
      .select('*').eq('day_id', day.id)
    const salesMap = {}
    ;(salesData || []).forEach(s => { salesMap[s.shop_id] = s })
    setSales(salesMap)

    // Load expenses
    const { data: expData } = await supabase.from('expenses')
      .select('*, expense_categories(name)').eq('day_id', day.id).order('created_at')
    setExpenses(expData || [])
    setLoading(false)
  }, [date])

  useEffect(() => { loadDay() }, [loadDay])

  // ── Sale update ──────────────────────────────────────────────────────────────
  async function updateSale(shopId, field, value) {
    const current = sales[shopId] || { quantity: 0, price: 0, payment_type: 'Наличка' }
    const updated = { ...current, [field]: value }
    setSales(prev => ({ ...prev, [shopId]: updated }))

    setSaving(s => ({ ...s, [shopId]: true }))
    if (current.id) {
      await supabase.from('sales').update({ [field]: value }).eq('id', current.id)
    } else {
      const { data } = await supabase.from('sales').upsert({
        day_id: dayId,
        shop_id: shopId,
        quantity: updated.quantity || 0,
        price: updated.price || 0,
        payment_type: updated.payment_type || 'Наличка',
      }).select().single()
      if (data) setSales(prev => ({ ...prev, [shopId]: data }))
    }
    setSaving(s => ({ ...s, [shopId]: false }))
  }

  // ── Expense actions ──────────────────────────────────────────────────────────
  async function addExpense() {
    const defCat = categories.find(c => c.name !== 'Прочее') || categories[0]
    const { data } = await supabase.from('expenses').insert({
      day_id: dayId,
      category_id: defCat?.id || null,
      custom_label: '',
      amount: 0,
    }).select('*, expense_categories(name)').single()
    if (data) setExpenses(prev => [...prev, data])
  }

  async function updateExpense(id, fields) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e))
    await supabase.from('expenses').update(fields).eq('id', id)
  }

  async function removeExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    await supabase.from('expenses').delete().eq('id', id)
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  let totalIncome = 0, totalNal = 0, totalKaspi = 0
  shops.forEach(sh => {
    const s = sales[sh.id]
    if (!s) return
    const sum = (s.quantity || 0) * (s.price || 0)
    totalIncome += sum
    if (s.payment_type === 'Каспи') totalKaspi += sum
    else totalNal += sum
  })
  const totalExp = calcDayExpenses(expenses)
  const profit = totalIncome - totalExp

  const salesArr = shops.map(sh => sales[sh.id]).filter(Boolean)

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="header">
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Рабочий день
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input"
          style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', padding: '8px 12px' }}
        />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* ── Shops ── */}
        <div className="section-title"><span>🏪</span> Магазины</div>

        {shops.map(sh => {
          const s = sales[sh.id] || {}
          const sum = (parseFloat(s.quantity) || 0) * (parseFloat(s.price) || 0)
          const isSaving = saving[sh.id]
          return (
            <div className="card" key={sh.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{sh.name}</span>
                <span style={{ color: sum > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700, fontSize: 14 }}>
                  {sum > 0 ? fmtMoney(sum) : '—'}
                  {isSaving && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>↑</span>}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="field-label">Кол-во (шт)</div>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    value={s.quantity || ''}
                    onChange={e => updateSale(sh.id, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="field-label">Цена (₸)</div>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    value={s.price || ''}
                    onChange={e => updateSale(sh.id, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="field-label">Оплата</div>
                  <select
                    className="select"
                    value={s.payment_type || 'Наличка'}
                    onChange={e => updateSale(sh.id, 'payment_type', e.target.value)}
                  >
                    <option>Наличка</option>
                    <option>Каспи</option>
                  </select>
                </div>
              </div>
            </div>
          )
        })}

        {/* ── Income summary ── */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
          <div className="row"><span className="row-label">💵 Наличка</span><span>{fmtMoney(totalNal)}</span></div>
          <div className="row"><span className="row-label">📱 Каспи</span><span>{fmtMoney(totalKaspi)}</span></div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
            <div className="row">
              <span className="row-label">Итого доход</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>{fmtMoney(totalIncome)}</span>
            </div>
          </div>
        </div>

        {/* ── Expenses ── */}
        <div className="section-title"><span>💸</span> Расходы</div>

        {expenses.map(e => {
          const isOther = e.expense_categories?.name === 'Прочее' || !e.category_id
          return (
            <div className="card" key={e.id}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1.4 }}>
                  <div className="field-label">Категория</div>
                  <select
                    className="select"
                    value={e.category_id || ''}
                    onChange={async ev => {
                      const catId = ev.target.value || null
                      const cat = categories.find(c => c.id === catId)
                      await updateExpense(e.id, {
                        category_id: catId,
                        'expense_categories': cat ? { name: cat.name } : null
                      })
                    }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="field-label">Сумма (₸)</div>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    value={e.amount || ''}
                    onChange={ev => updateExpense(e.id, { amount: parseFloat(ev.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={() => removeExpense(e.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1, marginBottom: 2 }}
                >×</button>
              </div>
              {isOther && (
                <div style={{ marginTop: 8 }}>
                  <input
                    className="input"
                    type="text"
                    value={e.custom_label || ''}
                    onChange={ev => updateExpense(e.id, { custom_label: ev.target.value })}
                    placeholder="Описание"
                  />
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={addExpense}
          style={{
            width: '100%', background: 'var(--bg2)', border: '1px dashed var(--border)',
            borderRadius: 10, color: 'var(--muted)', padding: 12,
            cursor: 'pointer', fontSize: 14, marginBottom: 4
          }}
        >
          + Добавить расход
        </button>

        {/* ── Day total ── */}
        <div className={`profit-card ${profit >= 0 ? 'positive' : 'negative'}`}>
          <div className="row"><span className="row-label">Доход</span><span>{fmtMoney(totalIncome)}</span></div>
          <div className="row"><span className="row-label">Расходы</span><span style={{ color: 'var(--red)' }}>− {fmtMoney(totalExp)}</span></div>
          <div style={{ borderTop: `1px solid ${profit >= 0 ? '#22543d' : '#7f1d1d'}`, marginTop: 8, paddingTop: 8 }}>
            <div className="row">
              <span style={{ fontWeight: 700, fontSize: 15 }}>Чистая прибыль</span>
              <span style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 800, fontSize: 17 }}>
                {fmtMoney(profit)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
