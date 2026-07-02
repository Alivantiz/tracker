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
  let sold = 0, returns = 0, bonus = 0, revenue = 0
  let byPayment = { 'Наличка': 0, 'Каспи': 0 }

  ;(sales || []).forEach(s => {
    const q = Number(s.quantity) || 0
    const r = Number(s.returns) || 0
    const b = Number(s.bonus) || 0
    const p = Number(s.price) || 0
    const net = q - r
    const sum = net * p
    sold += q
    returns += r
    bonus += b
    revenue += sum
    const pt = s.payment_type || 'Наличка'
    if (byPayment[pt] !== undefined) byPayment[pt] += sum
    else byPayment[pt] = (byPayment[pt] || 0) + sum
  })

  const totalExpenses  = (expenses  || []).reduce((a, e) => a + (e.amount || 0), 0)
  const totalPurchases = (purchases || []).reduce((a, e) => a + (e.amount || 0), 0)
  const totalSalaries  = (salaries  || []).reduce((a, e) => a + (e.amount || 0), 0)
  const totalCosts = totalExpenses + totalPurchases + totalSalaries

  const net = sold - returns
  return {
    // штуки
    sold, returns, bonus,
    net,              // чистые продажи = продано − возврат (для выручки)
    given: sold + bonus + returns, // выдано свежих с рук = продано + бонус + возврат (возврат = свежая замена старым; старые списываются)
    revenue,
    byPayment,
    // деньги
    totalExpenses, totalPurchases, totalSalaries, totalCosts,
    profit: revenue - totalCosts
  }
}

// Остаток лепёшек за день = испечено − выдано (не меньше 0).
export function dayRemaining(baked, given) {
  return Math.max(0, (Number(baked) || 0) - (Number(given) || 0))
}
