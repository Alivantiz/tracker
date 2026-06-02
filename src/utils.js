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

export function calcDayIncome(sales) {
  return (sales || []).reduce((a, s) => a + (s.quantity || 0) * (s.price || 0), 0)
}

export function calcDayExpenses(expenses) {
  return (expenses || []).reduce((a, e) => a + (e.amount || 0), 0)
}
