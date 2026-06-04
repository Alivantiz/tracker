export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export function fmtMoney(n) {
  const num = Number(n || 0)
  return num.toLocaleString('ru-KZ') + ' ₸'
}

export function fmtMonthLabel(ym) {
  const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m)]} ${y}`
}

export function calcDayStats(sales, expenses, purchases, salaries) {
  let sold = 0, returns = 0, revenue = 0
  let byPayment = { 'Наличка': 0, 'Каспи': 0, 'Карта': 0 }

  ;(sales || []).forEach(s => {
    const q = s.quantity || 0
    const r = s.returns || 0
    const p = s.price || 0
    const net = q - r
    const sum = net * p
    sold += q
    returns += r
    revenue += sum
    const pt = s.payment_type || 'Наличка'
    if (byPayment[pt] !== undefined) byPayment[pt] += sum
    else byPayment[pt] = (byPayment[pt] || 0) + sum
  })

  const totalExpenses  = (expenses  || []).reduce((a, e) => a + (e.amount || 0), 0)
  const totalPurchases = (purchases || []).reduce((a, e) => a + (e.amount || 0), 0)
  const totalSalaries  = (salaries  || []).reduce((a, e) => a + (e.amount || 0), 0)
  const totalCosts = totalExpenses + totalPurchases + totalSalaries

  return {
    sold, returns, net: sold - returns, revenue,
    byPayment,
    totalExpenses, totalPurchases, totalSalaries, totalCosts,
    profit: revenue - totalCosts
  }
}
