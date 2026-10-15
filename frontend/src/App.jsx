import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = '';

const COLORS = {
  bg: '#0a0a0a', panel: '#111111', border: '#222222', text: '#e0e0e0', dim: '#666666',
  clean: '#22c55e', infected: '#ef4444', quarantined: '#f59e0b',
  red: '#ef4444', blue: '#3b82f6', orange: '#f97316', purple: '#a855f7',
  yellow: '#eab308', gray: '#6b7280', cyan: '#06b6d4',
};

const PROFILES = [
  { key: 'tv_box', label: 'TV Box' },
  { key: 'smart_fridge', label: 'Fridge' },
  { key: 'security_camera', label: 'Camera' },
  { key: 'nas_box', label: 'NAS' },
];

function NetworkGraph({ devices, topology, selectedId, onSelect, label, flashDevices }) {
  const W = 400, H = 360, CX = W / 2, CY = H / 2, R = 130;
  const n = devices.length;
  const positions = devices.map((_, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });
  const posMap = {};
  devices.forEach((d, i) => { posMap[d.id] = positions[i]; });

  const edges = [];
  const seen = new Set();
  Object.entries(topology || {}).forEach(([from, tos]) => {
    (tos || []).forEach(to => {
      const key = [from, to].sort().join('-');
      if (!seen.has(key) && posMap[from] && posMap[to]) {
        seen.add(key);
        edges.push({ from: posMap[from], to: posMap[to] });
      }
    });
  });

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: COLORS.cyan, marginBottom: 4, fontWeight: 'bold', letterSpacing: 2 }}>{label}</div>
      <svg width={W} height={H} style={{ background: COLORS.panel, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
        {edges.map((e, i) => (
          <line key={i} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke="#374151" strokeWidth={1.5} />
        ))}
        {devices.map((d, i) => {
          const p = positions[i];
          const color = d.quarantined ? COLORS.quarantined : d.infected ? COLORS.infected : COLORS.clean;
          const selected = d.id === selectedId;
          const flashing = flashDevices && flashDevices.has(d.id);
          const statusLabel = d.quarantined ? 'QUAR' : d.infected ? 'INF' : 'CLEAN';
          const displayName = (d.name || '').length > 12 ? d.name.slice(0, 12) + '…' : d.name;
          return (
            <g key={d.id} onClick={() => onSelect(d.id)} style={{ cursor: 'pointer' }}>
              {selected && <circle cx={p.x} cy={p.y} r={26} fill="none" stroke="white" strokeWidth={2} opacity={0.6} />}
              {flashing && <circle cx={p.x} cy={p.y} r={30} fill="none" stroke={COLORS.yellow} strokeWidth={2} opacity={0.8}>
                <animate attributeName="r" from="24" to="36" dur="0.8s" repeatCount="3" />
                <animate attributeName="opacity" from="0.9" to="0" dur="0.8s" repeatCount="3" />
              </circle>}
              <circle cx={p.x} cy={p.y} r={20} fill={color} opacity={0.85} />
              <text x={p.x} y={p.y - 28} textAnchor="middle" fill={color} fontSize={9} fontFamily="monospace">{statusLabel}</text>
              <text x={p.x} y={p.y + 36} textAnchor="middle" fill={COLORS.dim} fontSize={10} fontFamily="monospace">{displayName}</text>
              <text x={p.x} y={p.y + 5} textAnchor="middle" fill="#000" fontSize={11} fontWeight="bold" fontFamily="monospace">
                G{d.infection_generation || 0}
              </text>
            </g>
          );
        })}
        {n === 0 && <text x={CX} y={CY} textAnchor="middle" fill={COLORS.dim} fontSize={13} fontFamily="monospace">No devices</text>}
      </svg>
    </div>
  );
}

function FileBrowser({ device, files, fileContent, selectedFile, onSelectFile }) {
  if (!device) return <div style={{ padding: 16, color: COLORS.dim }}>Select a device to browse files</div>;

  const fileColor = (path) => {
    if (path.includes('/tmp/') || path.includes('/tmp/.')) return COLORS.red;
    if (path.includes('/log/')) return COLORS.blue;
    if (path.includes('/cache/')) return COLORS.yellow;
    return COLORS.gray;
  };

  return (
    <div style={{ display: 'flex', gap: 8, height: 300 }}>
      <div style={{ width: 260, overflowY: 'auto', background: COLORS.panel, borderRadius: 6, padding: 8, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.cyan, marginBottom: 8 }}>{device.name}</div>
        {(files || []).map(f => (
          <div
            key={f.path}
            onClick={() => onSelectFile(f.path)}
            style={{
              padding: '4px 6px', cursor: 'pointer', fontSize: 11,
              color: fileColor(f.path), borderRadius: 3,
              background: f.path === selectedFile ? '#1a1a2e' : 'transparent',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {f.path} <span style={{ color: COLORS.dim }}>({f.size}b)</span>
          </div>
        ))}
        {(!files || files.length === 0) && <div style={{ color: COLORS.dim, fontSize: 11 }}>No files</div>}
      </div>
      <div style={{ flex: 1, background: '#0d0d0d', borderRadius: 6, padding: 8, overflowY: 'auto', border: `1px solid ${COLORS.border}` }}>
        <pre style={{ fontSize: 11, color: COLORS.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
          {fileContent || 'Select a file to view contents'}
        </pre>
      </div>
    </div>
  );
}

function LogFeed({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);

  const borderColor = (entry) => {
    if (entry.type === 'coordination_event') return COLORS.yellow;
    if (entry.type === 'attacker_action') return COLORS.red;
    if (entry.type === 'defender_scan') return COLORS.blue;
    if (entry.type === 'infection') return COLORS.orange;
    if (entry.type === 'connection' || entry.type === 'topology_update') return COLORS.purple;
    return COLORS.gray;
  };

  return (
    <div ref={ref} style={{ maxHeight: 400, overflowY: 'auto', background: COLORS.panel, borderRadius: 6, padding: 8, border: `1px solid ${COLORS.border}` }}>
      {logs.map((entry, i) => (
        <div key={i} style={{ borderLeft: `3px solid ${borderColor(entry)}`, paddingLeft: 8, marginBottom: 6, fontSize: 11 }}>
          <div style={{ color: COLORS.dim }}>[{entry.track || ''}] {entry.type} {entry.device || ''}</div>
          {entry.type === 'coordination_event' && (
            <div style={{ color: COLORS.yellow, fontWeight: 'bold' }}>
              ⚡ EMERGENCE SIGNAL: {entry.signal} — {entry.path}
              <div style={{ fontWeight: 'normal', color: COLORS.text, marginTop: 2 }}>{entry.content}</div>
            </div>
          )}
          {entry.action && <div style={{ color: COLORS.text }}>Action: {entry.action} {entry.result ? `→ ${entry.result}` : ''}</div>}
          {entry.reasoning && <div style={{ color: COLORS.dim, fontStyle: 'italic' }}>{entry.reasoning.slice(0, 200)}</div>}
          {entry.notes && <div style={{ color: COLORS.cyan, fontSize: 10 }}>Notes: {entry.notes.slice(0, 150)}</div>}
          {entry.log && <div style={{ color: COLORS.text, fontSize: 10 }}>{entry.log.slice(0, 300)}</div>}
          {entry.threat_level && <div style={{ color: entry.threat_level === 'critical' ? COLORS.red : entry.threat_level === 'high' ? COLORS.orange : COLORS.dim }}>Threat: {entry.threat_level}</div>}
        </div>
      ))}
      {logs.length === 0 && <div style={{ color: COLORS.dim }}>No events yet</div>}
    </div>
  );
}

function MetricsPanel({ runId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!runId) return;
    const load = async () => {
      try {
        const r = await fetch(`${API}/metrics/runs/${runId}`);
        if (r.ok) setData(await r.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [runId]);

  if (!data || !data.run) return <div style={{ color: COLORS.dim, padding: 16 }}>No metrics yet. Start a simulation.</div>;

  const run = data.run;
  const s = data.summary || {};
  const coordEvents = data.coordination_events || [];

  const profileKeys = ['tv_box', 'smart_fridge', 'security_camera', 'nas_box'];
  const profileLabels = { tv_box: 'TV Box', smart_fridge: 'Fridge', security_camera: 'Camera', nas_box: 'NAS' };

  const getRate = (track, profile) => {
    const p = (s.spread_success_by_profile || {})[track] || {};
    return p[profile] ? `${(p[profile].success_rate * 100).toFixed(0)}%` : '—';
  };
  const getSteps = (track, profile) => {
    const p = (s.spread_success_by_profile || {})[track] || {};
    return p[profile] ? p[profile].avg_steps.toFixed(1) : '—';
  };

  const rows = [
    ['Negotiation occurred', run.negotiation_occurred_a ? 'Yes' : 'No', run.negotiation_occurred_b ? 'Yes' : 'No'],
    ['Peak infection rate', `${((run.peak_infection_rate_a || 0) * 100).toFixed(0)}%`, `${((run.peak_infection_rate_b || 0) * 100).toFixed(0)}%`],
    ['Ticks to full infection', run.ticks_to_full_infection_a ?? '—', run.ticks_to_full_infection_b ?? '—'],
    ['Avg spread steps', (s.avg_steps_per_successful_spread?.A || 0).toFixed(1), (s.avg_steps_per_successful_spread?.B || 0).toFixed(1)],
    ['Negotiation count', s.negotiation_rate?.A ?? 0, s.negotiation_rate?.B ?? 0],
    ...profileKeys.map(p => [`Spread: ${profileLabels[p]} rate`, getRate('A', p), getRate('B', p)]),
    ...profileKeys.map(p => [`Steps: ${profileLabels[p]}`, getSteps('A', p), getSteps('B', p)]),
    ['Emergence signals', 'N/A', s.coordination_events_count ?? 0],
  ];

  const cellStyle = { padding: '6px 12px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 12 };

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: COLORS.panel, borderRadius: 6 }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, textAlign: 'left', color: COLORS.dim }}>Metric</th>
            <th style={{ ...cellStyle, textAlign: 'center', color: COLORS.cyan }}>Track A (Control)</th>
            <th style={{ ...cellStyle, textAlign: 'center', color: COLORS.yellow }}>Track B (Emergent)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b], i) => (
            <tr key={i}>
              <td style={{ ...cellStyle, color: COLORS.text }}>{label}</td>
              <td style={{ ...cellStyle, textAlign: 'center', color: COLORS.text }}>{a}</td>
              <td style={{ ...cellStyle, textAlign: 'center', color: COLORS.text }}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {coordEvents.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: COLORS.yellow, fontWeight: 'bold', marginBottom: 8, fontSize: 13 }}>⚡ Coordination Events</div>
          {coordEvents.map((ev, i) => (
            <div key={i} style={{ background: '#1a1a0a', border: `1px solid ${COLORS.yellow}33`, borderRadius: 4, padding: 8, marginBottom: 6, fontSize: 11 }}>
              <span style={{ color: COLORS.yellow }}>Tick {ev.tick}</span> — <span style={{ color: COLORS.cyan }}>{ev.signal_type}</span> — {ev.file_path}
              <div style={{ color: COLORS.dim, marginTop: 4 }}>{(ev.content || '').slice(0, 200)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ControlPanel({ running, onStart, onStop, onReset, onAddDevice, onConnect, onInfect, devices }) {
  const [profile, setProfile] = useState('tv_box');
  const [track, setTrack] = useState('A');
  const [label, setLabel] = useState('');
  const [connectA, setConnectA] = useState('');
  const [connectB, setConnectB] = useState('');
  const [infectId, setInfectId] = useState('');

  const inputStyle = {
    background: '#1a1a1a', border: `1px solid ${COLORS.border}`, color: COLORS.text,
    padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'inherit',
  };
  const btnStyle = (color) => ({
    background: 'transparent', border: `1px solid ${color}`, color,
    padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.dim, marginBottom: 2 }}>Profile</div>
          <select value={profile} onChange={e => setProfile(e.target.value)} style={inputStyle}>
            {PROFILES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.dim, marginBottom: 2 }}>Track</div>
          <select value={track} onChange={e => setTrack(e.target.value)} style={inputStyle}>
            <option value="A">A</option><option value="B">B</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.dim, marginBottom: 2 }}>Label</div>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="name" style={{ ...inputStyle, width: 80 }} />
        </div>
        <button onClick={() => { onAddDevice(profile, label || profile, track); setLabel(''); }} style={btnStyle(COLORS.clean)}>+ Device</button>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.dim, marginBottom: 2 }}>Device A</div>
          <select value={connectA} onChange={e => setConnectA(e.target.value)} style={inputStyle}>
            <option value="">--</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name?.slice(0, 20)}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.dim, marginBottom: 2 }}>Device B</div>
          <select value={connectB} onChange={e => setConnectB(e.target.value)} style={inputStyle}>
            <option value="">--</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name?.slice(0, 20)}</option>)}
          </select>
        </div>
        <button onClick={() => { if (connectA && connectB) onConnect(connectA, connectB); }} style={btnStyle(COLORS.purple)}>Connect</button>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.dim, marginBottom: 2 }}>Patient Zero</div>
          <select value={infectId} onChange={e => setInfectId(e.target.value)} style={inputStyle}>
            <option value="">--</option>
            {devices.filter(d => !d.infected).map(d => <option key={d.id} value={d.id}>{d.name?.slice(0, 20)}</option>)}
          </select>
        </div>
        <button onClick={() => { if (infectId) onInfect(infectId); }} style={btnStyle(COLORS.red)}>Infect</button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {!running && <button onClick={onStart} style={btnStyle(COLORS.clean)}>▶ Start</button>}
        {running && <button onClick={onStop} style={btnStyle(COLORS.orange)}>■ Stop</button>}
        <button onClick={onReset} style={btnStyle(COLORS.dim)}>↻ Reset</button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ devices_a: [], devices_b: [], topology_a: {}, topology_b: {}, tick: 0, running: false, run_id: null });
  const [logs, setLogs] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileContent, setFileContent] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [tab, setTab] = useState('live');
  const [trackView, setTrackView] = useState('both');
  const [flashDevices, setFlashDevices] = useState(new Set());
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const allDevices = [...(state.devices_a || []), ...(state.devices_b || [])];

  const connectWs = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'state') {
        setState(prev => ({
          devices_a: msg.devices_a || prev.devices_a,
          devices_b: msg.devices_b || prev.devices_b,
          topology_a: msg.topology_a || prev.topology_a,
          topology_b: msg.topology_b || prev.topology_b,
          tick: msg.tick ?? prev.tick,
          running: msg.running ?? prev.running,
          run_id: msg.run_id || prev.run_id,
        }));
      } else if (msg.type === 'reset') {
        setState({ devices_a: [], devices_b: [], topology_a: {}, topology_b: {}, tick: 0, running: false, run_id: null });
        setLogs([]);
        setSelectedDevice(null);
      } else if (msg.type === 'coordination_event') {
        setFlashDevices(prev => new Set([...prev, msg.device_id]));
        setTimeout(() => setFlashDevices(prev => { const next = new Set(prev); next.delete(msg.device_id); return next; }), 3000);
        setLogs(prev => [...prev.slice(-200), msg]);
      } else {
        if (msg.type === 'system' && msg.run_id) {
          setState(prev => ({ ...prev, run_id: msg.run_id }));
        }
        setLogs(prev => [...prev.slice(-200), msg]);
      }
    };

    ws.onclose = () => { reconnectRef.current = setTimeout(connectWs, 2000); };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connectWs();
    return () => { wsRef.current?.close(); clearTimeout(reconnectRef.current); };
  }, [connectWs]);

  useEffect(() => {
    if (!selectedDevice) return;
    const load = async () => {
      try {
        const r = await fetch(`${API}/devices/${selectedDevice}/files`);
        if (r.ok) setFiles(await r.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [selectedDevice]);

  const loadFile = async (path) => {
    setSelectedFile(path);
    try {
      const r = await fetch(`${API}/devices/${selectedDevice}/file?path=${encodeURIComponent(path)}`);
      if (r.ok) { const d = await r.json(); setFileContent(d.content || ''); }
    } catch {}
  };

  const api = async (url, body) => {
    try { await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch {}
  };

  const selectedDeviceObj = allDevices.find(d => d.id === selectedDevice);
  const headerStyle = { padding: '16px 24px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 };
  const tabBtnStyle = (active) => ({
    background: active ? COLORS.border : 'transparent', border: `1px solid ${COLORS.border}`,
    color: active ? COLORS.text : COLORS.dim, padding: '4px 12px', borderRadius: 4,
    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
  });
  const trackBtnStyle = (active) => ({
    background: active ? '#1a2a1a' : 'transparent', border: `1px solid ${active ? COLORS.cyan : COLORS.border}`,
    color: active ? COLORS.cyan : COLORS.dim, padding: '4px 10px', borderRadius: 4,
    cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
  });

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>WORMSIM</span>
          <span style={{ color: COLORS.dim, fontSize: 12 }}>tick {state.tick}</span>
          <span style={{ color: state.running ? COLORS.clean : COLORS.dim, fontSize: 12 }}>{state.running ? '● RUNNING' : '○ STOPPED'}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTrackView('A')} style={trackBtnStyle(trackView === 'A')}>Control (A)</button>
          <button onClick={() => setTrackView('B')} style={trackBtnStyle(trackView === 'B')}>Emergent (B)</button>
          <button onClick={() => setTrackView('both')} style={trackBtnStyle(trackView === 'both')}>Both</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('live')} style={tabBtnStyle(tab === 'live')}>Live</button>
          <button onClick={() => setTab('metrics')} style={tabBtnStyle(tab === 'metrics')}>Metrics</button>
        </div>
      </div>

      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
        <ControlPanel
          running={state.running}
          onStart={() => api('/simulation/start', { tick_interval: 15, defender_interval: 3 })}
          onStop={() => api('/simulation/stop', {})}
          onReset={() => fetch(`${API}/reset`, { method: 'DELETE' })}
          onAddDevice={(profile, label, track) => api('/devices', { profile, label, track })}
          onConnect={(a, b) => api('/devices/connect', { device_id_a: a, device_id_b: b })}
          onInfect={(id) => api('/devices/infect', { device_id: id })}
          devices={allDevices}
        />
      </div>

      {tab === 'live' && (
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {(trackView === 'A' || trackView === 'both') && (
              <NetworkGraph devices={state.devices_a} topology={state.topology_a} selectedId={selectedDevice} onSelect={setSelectedDevice} label="TRACK A — CONTROL" flashDevices={flashDevices} />
            )}
            {(trackView === 'B' || trackView === 'both') && (
              <NetworkGraph devices={state.devices_b} topology={state.topology_b} selectedId={selectedDevice} onSelect={setSelectedDevice} label="TRACK B — EMERGENT" flashDevices={flashDevices} />
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: COLORS.cyan, marginBottom: 8, fontWeight: 'bold' }}>FILE BROWSER</div>
            <FileBrowser device={selectedDeviceObj} files={files} fileContent={fileContent} selectedFile={selectedFile} onSelectFile={loadFile} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: COLORS.cyan, marginBottom: 8, fontWeight: 'bold' }}>EVENT LOG</div>
            <LogFeed logs={logs} />
          </div>
        </div>
      )}

      {tab === 'metrics' && (
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 12, color: COLORS.cyan, marginBottom: 12, fontWeight: 'bold' }}>COMPARISON METRICS</div>
          <MetricsPanel runId={state.run_id} />
        </div>
      )}
    </div>
  );
}
