import { supabase } from '../lib/supabase'

export type VehicleLookupResult = {
  plate: string
  brand: string | null
  model: string | null
  year: number | null
  modelYear: number | null
  color: string | null
  fuel: string | null
  city: string | null
  state: string | null
  type: 'car' | 'van'
  suggestedCapacity: number
  verifiedAt: string
  cached?: boolean
}

export function normalizeVehiclePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

export function isValidVehiclePlate(value: string) {
  return /^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(normalizeVehiclePlate(value))
}

async function getFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Falha ao consultar a placa.'
  const context = (error as { context?: Response } | null)?.context
  if (!context || typeof context.json !== 'function') return fallback

  try {
    const response = typeof context.clone === 'function' ? context.clone() : context
    const payload = await response.json() as { error?: unknown; message?: unknown }
    if (typeof payload.error === 'string') return payload.error
    if (typeof payload.message === 'string') return payload.message
    return fallback
  } catch {
    return fallback
  }
}

export async function lookupVehicleByPlate(value: string): Promise<VehicleLookupResult> {
  const plate = normalizeVehiclePlate(value)
  if (!isValidVehiclePlate(plate)) throw new Error('Informe uma placa válida, como ABC1234 ou ABC1D23.')
  if (!supabase) throw new Error('Conecte o aplicativo ao Supabase para consultar a placa.')

  const { data, error } = await supabase.functions.invoke('vehicle-lookup', { body: { plate } })
  if (error) throw new Error(await getFunctionErrorMessage(error))
  if (data?.error) throw new Error(data.error)
  return data as VehicleLookupResult
}
