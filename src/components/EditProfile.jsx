import { useState } from 'react'
import { updateProfile, uploadAvatar } from '../lib/supabase'
import { initials } from '../lib/format'

export default function EditProfile({ user, onClose, onUpdated, onError, onSuccess }) {
  const [name, setName] = useState(user.name ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [address, setAddress] = useState(user.address ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { data, error } = await uploadAvatar(user.id, file)
    if (error) onError?.('Não foi possível enviar a foto.')
    else setAvatarUrl(data.avatar_url)
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await updateProfile(user.id, { name, phone, address })
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
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
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
        <label className="field-label" htmlFor="editPhone">WhatsApp / Telefone</label>
        <input id="editPhone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(45) 99999-9999" />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="field-label" htmlFor="editAddress">Endereço</label>
        <input id="editAddress" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
      </div>

      <button className="btn btn-primary btn-block" onClick={handleSave} disabled={saving || uploading}>
        {saving ? 'Salvando…' : 'Salvar perfil'}
      </button>
    </div>
  )
}
