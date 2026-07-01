import React, { useState } from 'react'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'

interface ApiKeysViewProps {
  openModal: (kind: string, props?: any) => void
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({ openModal }) => {
  const { toast } = useUIStore()
  const [keys, setKeys] = useState<any[]>([])
  const [hooks, setHooks] = useState<any[]>([])
  const [show, setShow] = useState<string | null>(null)

  const revoke = (id: string) => {
    setKeys(keys.filter((k: any) => k.id !== id))
    toast('API key revoked', 'bad')
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">API keys & webhooks</h1>
          <p className="page-subtitle">{keys.length} active keys · {hooks.length} webhook destinations</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => openModal('newapikey', { onAdd: (k: any) => { const id = `k-${String(keys.length + 1).padStart(3, '0')}`; setKeys([{ id, name: k.name, scopes: k.scopes, key: `vpsmm_live_${Math.random().toString(36).slice(2, 6)}...${Math.random().toString(36).slice(2, 6)}`, created: new Date().toISOString().slice(0, 10), lastUsed: 'never' }, ...keys]); } })}><Icon name="plus" size={13}/>New API key</button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-head"><h3 className="card-title">API keys</h3></div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Created</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              {keys.map((k: any) => (
                <tr key={k.id}>
                  <td className="fw-6">{k.name}</td>
                  <td className="mono text-xs" style={{ cursor: 'pointer' }} onClick={() => setShow(show === k.id ? null : k.id)}>
                    {show === k.id ? 'vpsmm_live_a8x9b2c4d3kf5jh6...' : k.key}
                  </td>
                  <td><div className="flex gap-1 wrap">{k.scopes.map((s: string) => <span key={s} className="id-tag">{s}</span>)}</div></td>
                  <td className="tnum text-sm">{k.created}</td>
                  <td className="text-sm text-mute">{k.lastUsed}</td>
                  <td className="right"><button className="btn sm danger" onClick={() => revoke(k.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Webhooks</h3>
          <button className="btn sm" onClick={() => { setHooks([...hooks, { id: 'wh-' + String(hooks.length + 1).padStart(3, '0'), url: 'https://hooks.new-endpoint.local/incoming', events: ['vm.created'], status: 'Active', last200: 'never' }]); toast('Webhook endpoint added', 'ok'); }}><Icon name="plus" size={11}/>Add endpoint</button>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Endpoint URL</th><th>Events</th><th>Status</th><th>Last 200</th><th></th></tr></thead>
            <tbody>
              {hooks.map((h: any) => (
                <tr key={h.id}>
                  <td className="mono text-xs" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.url}</td>
                  <td><div className="flex gap-1 wrap">{h.events.map((e: string) => <span key={e} className="id-tag">{e}</span>)}</div></td>
                  <td><span className={`pill ${h.status === 'Active' ? 'ok' : 'bad'}`}><span className="dot"/>{h.status}</span></td>
                  <td className="text-sm text-mute">{h.last200}</td>
                  <td className="right">
                    <button className="btn sm" onClick={() => toast(`Test event sent to ${h.id}`, 'info')}>Test</button>
                    <button className="btn sm" style={{ marginLeft: 4 }} onClick={() => toast('Webhook editor opened', 'info')}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
