import { useState } from 'react'
import { BadgeCheck, BusFront, CarFront, Search } from 'lucide-react'
import {
  isValidVehiclePlate,
  lookupVehicleByPlate,
  normalizeVehiclePlate,
  updateProfile,
  uploadAvatar,
} from '../lib/supabase'
import { initials } from '../lib/format'

export default function EditProfile({ user, onClose, onUpdated, onError, onSuccess }) {
  const [name, setName] = useState(user.name ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [address, setAddress] = useState(user.address ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [vehicleBrand, setVehicleBrand] = useState(user.vehicle_brand ?? '')
  const [vehicleModel, setVehicleModel] = useState(user.vehicle_model ?? '')
  const [vehiclePlate, setVehiclePlate] = useState(user.vehicle_plate ?? '')
  const [vehicleColor, setVehicleColor] = useState(user.vehicle_color ?? '')
  const [vehicleYear, setVehicleYear] = useState(user.vehicle_year ?? '')
  const [vehicleModelYear, setVehicleModelYear] = useState(user.vehicle_model_year ?? '')
  const [vehicleType, setVehicleType] = useState(user.vehicle_type ?? 'car')
  const [vehicleCapacity, setVehicleCapacity] = useState(user.vehicle_capacity ?? 6)
  const [vehicleLookupVerifiedAt, setVehicleLookupVerifiedAt] = useState(user.vehicle_lookup_verified_at ?? null)
  const [lookingUpVehicle, setLookingUpVehicle] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      onError?.('Escolha uma imagem de até 5 MB.')
      return
    }
    setUploading(true)
    const { data, error } = await uploadAvatar(user.id, file)
    if (error) onError?.('Não foi possível enviar a foto.')
    else setAvatarUrl(data.avatar_url)
    setUploading(false)
  }

  function selectVehicleType(type) {
    setVehicleType(type)
    setVehicleCapacity((current) => {
      const capacity = Number(current) || (type === 'van' ? 15 : 4)
      if (type === 'van') return Math.min(20, Math.max(4, capacity))
      return Math.min(8, Math.max(1, capacity))
    })
  }

  async function handleVehicleLookup() {
    const plate = normalizeVehiclePlate(vehiclePlate)
    setVehiclePlate(plate)
    if (!isValidVehiclePlate(plate)) {
      onError?.('Informe uma placa válida, como ABC1234 ou ABC1D23.')
      return
    }

    setLookingUpVehicle(true)
    const { data, error } = await lookupVehicleByPlate(plate)
    setLookingUpVehicle(false)
    if (error || !data) {
      onError?.(error?.message || 'Não foi possível consultar a placa.')
      return
    }

    setVehicleBrand(data.brand ?? '')
    setVehicleModel(data.model ?? '')
    setVehicleColor(data.color ?? '')
    setVehicleYear(data.year ?? '')
    setVehicleModelYear(data.modelYear ?? '')
    setVehicleType(data.type ?? 'car')
    setVehicleCapacity(data.suggestedCapacity ?? (data.type === 'van' ? 15 : 4))
    setVehicleLookupVerifiedAt(data.verifiedAt ?? new Date().toISOString())
    onSuccess?.('Veículo identificado. Confirme o tipo e a capacidade.')
  }

  async function handleSave() {
    if (user.role === 'driver') {
      if (!isValidVehiclePlate(vehiclePlate)) {
        onError?.('Informe uma placa válida antes de salvar.')
        return
      }
      const capacity = Number(vehicleCapacity)
      const min = vehicleType === 'van' ? 4 : 1
      const max = vehicleType === 'van' ? 20 : 8
      if (!Number.isInteger(capacity) || capacity < min || capacity > max) {
        onError?.(`Informe uma capacidade entre ${min} e ${max} passageiros.`)
        return
      }
    }

    setSaving(true)
    const { error } = await updateProfile(user.id, {
      name,
      phone,
      address,
      vehicleBrand,
      vehicleModel,
      vehiclePlate,
      vehicleColor,
      vehicleYear: Number(vehicleYear) || null,
      vehicleModelYear: Number(vehicleModelYear) || null,
      vehicleType,
      vehicleCapacity: Number(vehicleCapacity),
      vehicleLookupVerifiedAt,
    })
    setSaving(false)
    if (error) {
      onError?.('Não foi possível salvar seu perfil.')
      return
    }
    onSuccess?.('Perfil atualizado.')
    onUpdated?.()
    onClose?.()
  }

  return (
    <div className="profile-editor">
      <div className="profile-editor__photo">
        <div className="avatar" style={{ width: '5rem', height: '5rem', fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(name)}
        </div>
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          {uploading ? 'Enviando…' : 'Trocar foto'}
          <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="field-label" htmlFor="editName">Nome completo</label>
        <input id="editName" className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="field-label" htmlFor="editEmail">E-mail da conta</label>
        <input id="editEmail" className="input" type="email" value={user.email ?? ''} readOnly />
        <p style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>O e-mail de acesso é protegido pela sua conta.</p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="field-label" htmlFor="editPhone">WhatsApp / Telefone</label>
        <input id="editPhone" className="input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(45) 99999-9999" />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="field-label" htmlFor="editAddress">Endereço</label>
        <input id="editAddress" className="input" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Rua, número, bairro" />
      </div>

      {user.role === 'driver' && (
        <div className="vehicle-fields">
          <div className="section-heading" style={{ marginBottom: '0.875rem' }}>
            <div>
              <h3>Veículo principal</h3>
              <p style={{ fontSize: '0.8125rem', marginTop: '0.2rem' }}>Consulte a placa e confirme a lotação disponível para passageiros.</p>
            </div>
          </div>

          <div className="vehicle-lookup-row">
            <div>
              <label className="field-label" htmlFor="vehiclePlate">Placa</label>
              <input
                id="vehiclePlate"
                className="input"
                value={vehiclePlate}
                onChange={(event) => {
                  setVehiclePlate(event.target.value.toUpperCase())
                  setVehicleLookupVerifiedAt(null)
                }}
                placeholder="ABC1D23"
                maxLength={8}
                autoComplete="off"
              />
            </div>
            <button className="btn btn-secondary" type="button" onClick={handleVehicleLookup} disabled={lookingUpVehicle}>
              <Search size={17} aria-hidden="true" />
              {lookingUpVehicle ? 'Consultando…' : 'Consultar placa'}
            </button>
            {vehicleLookupVerifiedAt && (
              <span className="vehicle-verified"><BadgeCheck size={16} aria-hidden="true" /> Dados consultados</span>
            )}
          </div>

          <div className="vehicle-type-control" role="group" aria-label="Tipo de veículo">
            <button type="button" className={vehicleType === 'car' ? 'is-selected' : ''} onClick={() => selectVehicleType('car')}>
              <CarFront size={19} aria-hidden="true" />
              <span><strong>Carro</strong><small>Até 8 passageiros</small></span>
            </button>
            <button type="button" className={vehicleType === 'van' ? 'is-selected' : ''} onClick={() => selectVehicleType('van')}>
              <BusFront size={19} aria-hidden="true" />
              <span><strong>Van</strong><small>Até 20 passageiros</small></span>
            </button>
          </div>

          <div className="form-grid form-grid--vehicle">
            <div>
              <label className="field-label" htmlFor="vehicleBrand">Marca</label>
              <input id="vehicleBrand" className="input" value={vehicleBrand} onChange={(event) => setVehicleBrand(event.target.value)} placeholder="Ex: Renault" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleModel">Modelo</label>
              <input id="vehicleModel" className="input" value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} placeholder="Ex: Master Executive" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleColor">Cor</label>
              <input id="vehicleColor" className="input" value={vehicleColor} onChange={(event) => setVehicleColor(event.target.value)} placeholder="Ex: Prata" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleYear">Ano fabricação</label>
              <input id="vehicleYear" className="input" type="number" min="1886" max="2100" value={vehicleYear} onChange={(event) => setVehicleYear(event.target.value)} placeholder="2022" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleModelYear">Ano modelo</label>
              <input id="vehicleModelYear" className="input" type="number" min="1886" max="2100" value={vehicleModelYear} onChange={(event) => setVehicleModelYear(event.target.value)} placeholder="2023" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleCapacity">Capacidade de passageiros</label>
              <input
                id="vehicleCapacity"
                className="input"
                type="number"
                min={vehicleType === 'van' ? 4 : 1}
                max={vehicleType === 'van' ? 20 : 8}
                value={vehicleCapacity}
                onChange={(event) => setVehicleCapacity(event.target.value)}
              />
            </div>
          </div>
          <p className="vehicle-capacity-note">Confirme a capacidade no documento do veículo. A consulta da placa não substitui essa conferência.</p>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={handleSave} disabled={saving || uploading || lookingUpVehicle}>
        {saving ? 'Salvando…' : 'Salvar perfil'}
      </button>
    </div>
  )
}
