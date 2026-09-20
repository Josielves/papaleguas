import { useState } from 'react'
import { updateProfile, uploadAvatar } from '../lib/supabase'
import { initials } from '../lib/format'

export default function EditProfile({ user, onClose, onUpdated, onError, onSuccess }) {
  const [name, setName] = useState(user.name ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [address, setAddress] = useState(user.address ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [vehicleModel, setVehicleModel] = useState(user.vehicle_model ?? '')
  const [vehiclePlate, setVehiclePlate] = useState(user.vehicle_plate ?? '')
  const [vehicleColor, setVehicleColor] = useState(user.vehicle_color ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
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

  async function handleSave() {
    setSaving(true)
    const { error } = await updateProfile(user.id, {
      name,
      phone,
      address,
      vehicleModel,
      vehiclePlate,
      vehicleColor,
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
        <input id="editName" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="field-label" htmlFor="editEmail">E-mail da conta</label>
        <input id="editEmail" className="input" type="email" value={user.email ?? ''} readOnly />
        <p style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>O e-mail de acesso é protegido pela sua conta.</p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="field-label" htmlFor="editPhone">WhatsApp / Telefone</label>
        <input id="editPhone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(45) 99999-9999" />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="field-label" htmlFor="editAddress">Endereço</label>
        <input id="editAddress" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
      </div>

      {user.role === 'driver' && (
        <div className="vehicle-fields">
          <div className="section-heading" style={{ marginBottom: '0.875rem' }}>
            <div>
              <h3>Veículo principal</h3>
              <p style={{ fontSize: '0.8125rem', marginTop: '0.2rem' }}>Esses dados preenchem suas novas rotas.</p>
            </div>
          </div>
          <div className="form-grid form-grid--three">
            <div>
              <label className="field-label" htmlFor="vehicleModel">Modelo</label>
              <input id="vehicleModel" className="input" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Ex: Chevrolet Onix" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehicleColor">Cor</label>
              <input id="vehicleColor" className="input" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} placeholder="Ex: Prata" />
            </div>
            <div>
              <label className="field-label" htmlFor="vehiclePlate">Placa</label>
              <input id="vehiclePlate" className="input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} />
            </div>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={handleSave} disabled={saving || uploading}>
        {saving ? 'Salvando…' : 'Salvar perfil'}
      </button>
    </div>
  )
}
