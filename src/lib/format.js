export function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDeparture(iso) {
  if (!iso) return ''
  const departure = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const dateKey = (value) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`
  let day
  if (dateKey(departure) === dateKey(today)) day = 'Hoje'
  else if (dateKey(departure) === dateKey(tomorrow)) day = 'Amanhã'
  else day = departure.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

  return `${day} • ${formatTime(iso)}`
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('')
}
