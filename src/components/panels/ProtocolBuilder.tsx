import { useState } from 'react';
import { useReceiverStore } from '../../store/receiverStore';
import { adapterFromSchema } from '../../services/parsers/pluginLoader';
import type {
  ProtocolSchema, FrameConfig, MessageDef, FieldDef,
  ChecksumType, Endian, FieldType, OutputType,
} from '../../types/protocolSchema';

// ── Defaults ─────────────────────────────────────────────────────────────────

const defaultFrame = (): FrameConfig => ({
  sync: [0xAA, 0x55],
  endian: 'LE',
  headerSize: 8,
  msgId: { offset: 2, size: 2 },
  payloadLen: { offset: 4, size: 2 },
  checksum: 'none',
  trailer: [],
});

const defaultField = (): FieldDef => ({
  name: 'field',
  type: 'u8',
  offset: 0,
});

const defaultMessage = (): MessageDef => ({
  output: 'positionFix',
  fields: [defaultField()],
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface MsgEntry {
  id: string; // hex string, np. "0x0001"
  def: MessageDef;
}

// ── Generator .js ─────────────────────────────────────────────────────────────

function generateJs(schema: ProtocolSchema): string {
  const j = (v: unknown) => JSON.stringify(v, null, 2);
  const msgEntries = Object.entries(schema.messages)
    .map(([id, def]) => `    ${id}: ${j(def)}`)
    .join(',\n');

  return `// Wygenerowany przez GNSS Visualizer — Protocol Builder
// Załaduj ten plik w zakładce Odbiornik → "📦 Załaduj protokół .js"

export default ${j({
  name: schema.name,
  description: schema.description,
  $schema: true,
  frame: schema.frame,
  messages: schema.messages,
})};
`.replace(/"messages": \{\}/, `"messages": {\n${msgEntries}\n  }`);
}

// ── Małe komponenty formularza ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[#6e7681] text-[9px] uppercase tracking-wider mb-0.5 font-mono">{children}</div>;
}

function Inp({
  value, onChange, placeholder, className = '', type = 'text',
}: { value: string | number; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string }) {
  return (
    <input
      type={type}
      value={String(value)}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[10px] text-[#e6edf3] font-mono w-full focus:outline-none focus:border-[#58a6ff] ${className}`}
    />
  );
}

function Sel<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="bg-[#0d1117] border border-[#30363d] rounded px-1 py-1 text-[10px] text-[#e6edf3] font-mono w-full focus:outline-none focus:border-[#58a6ff]"
    >
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[#58a6ff] text-[10px] font-mono font-bold uppercase tracking-wider border-b border-[#21262d] pb-1 mb-3">
      {children}
    </div>
  );
}

function Btn({ onClick, children, variant = 'default' }: { onClick: () => void; children: React.ReactNode; variant?: 'default' | 'danger' | 'primary' }) {
  const cls = {
    default: 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff]',
    danger:  'border-[#da3633] text-[#da3633] hover:bg-[#da3633]/10',
    primary: 'border-[#238636] bg-[#238636]/20 text-[#3fb950] hover:bg-[#238636]/40',
  }[variant];
  return (
    <button onClick={onClick} className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${cls}`}>
      {children}
    </button>
  );
}

// ── Główny komponent ──────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function ProtocolBuilder({ onClose }: Props) {
  const addPlugin = useReceiverStore(s => s.addPlugin);
  const setActiveProtocol = useReceiverStore(s => s.setActiveProtocol);

  const [name, setName] = useState('MójProtokoł');
  const [desc, setDesc] = useState('Binarny protokół odbiornika GNSS');
  const [frame, setFrame] = useState<FrameConfig>(defaultFrame());
  const [messages, setMessages] = useState<MsgEntry[]>([
    { id: '0x0001', def: defaultMessage() },
  ]);
  const [preview, setPreview] = useState(false);

  // ── Pomocnicy frame ────────────────────────────────────────────────────────

  function setF<K extends keyof FrameConfig>(k: K, v: FrameConfig[K]) {
    setFrame(f => ({ ...f, [k]: v }));
  }

  function parseSyncStr(s: string): number[] {
    return s.split(/[\s,]+/).map(x => parseInt(x, 16)).filter(n => !isNaN(n));
  }

  function parseTrailerStr(s: string): number[] {
    if (!s.trim()) return [];
    return s.split(/[\s,]+/).map(x => parseInt(x, 16)).filter(n => !isNaN(n));
  }

  // ── Pomocnicy messages ─────────────────────────────────────────────────────

  function addMessage() {
    setMessages(ms => [...ms, { id: `0x${(ms.length + 1).toString(16).padStart(4, '0')}`, def: defaultMessage() }]);
  }

  function removeMessage(i: number) {
    setMessages(ms => ms.filter((_, j) => j !== i));
  }

  function updateMsgId(i: number, v: string) {
    setMessages(ms => ms.map((m, j) => j === i ? { ...m, id: v } : m));
  }

  function updateMsgDef<K extends keyof MessageDef>(i: number, k: K, v: MessageDef[K]) {
    setMessages(ms => ms.map((m, j) => j === i ? { ...m, def: { ...m.def, [k]: v } } : m));
  }

  function addField(mi: number) {
    setMessages(ms => ms.map((m, j) => j === mi
      ? { ...m, def: { ...m.def, fields: [...m.def.fields, defaultField()] } }
      : m));
  }

  function removeField(mi: number, fi: number) {
    setMessages(ms => ms.map((m, j) => j === mi
      ? { ...m, def: { ...m.def, fields: m.def.fields.filter((_, k) => k !== fi) } }
      : m));
  }

  function updateField<K extends keyof FieldDef>(mi: number, fi: number, k: K, v: FieldDef[K]) {
    setMessages(ms => ms.map((m, j) => j === mi
      ? { ...m, def: { ...m.def, fields: m.def.fields.map((f, k2) => k2 === fi ? { ...f, [k]: v } : f) } }
      : m));
  }

  // ── Budowanie schematu ─────────────────────────────────────────────────────

  function buildSchema(): ProtocolSchema {
    const msgs: Record<number, MessageDef> = {};
    for (const { id, def } of messages) {
      const num = parseInt(id, 16);
      if (!isNaN(num)) msgs[num] = def;
    }
    return { name, description: desc, $schema: true, frame, messages: msgs };
  }

  // ── Eksport ────────────────────────────────────────────────────────────────

  function handleDownload() {
    const js = generateJs(buildSchema());
    const blob = new Blob([js], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.js`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadNow() {
    const schema = buildSchema();
    const adapter = adapterFromSchema(schema);
    addPlugin(adapter);
    setActiveProtocol(adapter.name);
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const syncStr = frame.sync.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const trailerStr = frame.trailer?.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-4">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl w-full max-w-2xl mx-4 font-mono">

        {/* Nagłówek */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#21262d]">
          <div>
            <div className="text-[#58a6ff] font-bold text-sm">Kreator protokołu binarnego</div>
            <div className="text-[#484f58] text-[9px]">header + payload → ParsedData</div>
          </div>
          <button onClick={onClose} className="text-[#6e7681] hover:text-[#e6edf3] text-lg">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* 1. Podstawowe info */}
          <div>
            <SectionHeader>1. Informacje</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nazwa protokołu</Label>
                <Inp value={name} onChange={setName} placeholder="MójOdbiornik" />
              </div>
              <div>
                <Label>Opis</Label>
                <Inp value={desc} onChange={setDesc} placeholder="Opis skrócony" />
              </div>
            </div>
          </div>

          {/* 2. Ramkowanie */}
          <div>
            <SectionHeader>2. Ramkowanie (framing)</SectionHeader>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label>Bajty sync (hex, spacja lub przecinek)</Label>
                <Inp
                  value={syncStr}
                  onChange={v => setF('sync', parseSyncStr(v))}
                  placeholder="AA 55"
                />
              </div>
              <div>
                <Label>Rozmiar nagłówka [B] (offset payloadu)</Label>
                <Inp
                  type="number"
                  value={frame.headerSize}
                  onChange={v => setF('headerSize', parseInt(v) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* msgId */}
              <div className="bg-[#161b22] rounded p-2 space-y-1">
                <div className="text-[#8b949e] text-[9px] mb-1">ID wiadomości w nagłówku</div>
                <Label>Offset</Label>
                <Inp type="number" value={frame.msgId.offset}
                  onChange={v => setF('msgId', { ...frame.msgId, offset: parseInt(v) || 0 })} />
                <Label>Rozmiar [B]</Label>
                <Sel value={String(frame.msgId.size) as '1'|'2'|'4'}
                  onChange={v => setF('msgId', { ...frame.msgId, size: parseInt(v) as 1|2|4 })}
                  options={[{v:'1',l:'1 B'},{v:'2',l:'2 B'},{v:'4',l:'4 B'}]} />
              </div>
              {/* payloadLen */}
              <div className="bg-[#161b22] rounded p-2 space-y-1">
                <div className="text-[#8b949e] text-[9px] mb-1">Długość payloadu w nagłówku</div>
                <Label>Offset</Label>
                <Inp type="number" value={frame.payloadLen.offset}
                  onChange={v => setF('payloadLen', { ...frame.payloadLen, offset: parseInt(v) || 0 })} />
                <Label>Rozmiar [B]</Label>
                <Sel value={String(frame.payloadLen.size) as '1'|'2'|'4'}
                  onChange={v => setF('payloadLen', { ...frame.payloadLen, size: parseInt(v) as 1|2|4 })}
                  options={[{v:'1',l:'1 B'},{v:'2',l:'2 B'},{v:'4',l:'4 B'}]} />
              </div>
              {/* checksum + endian */}
              <div className="bg-[#161b22] rounded p-2 space-y-1">
                <div className="text-[#8b949e] text-[9px] mb-1">Checksum + byte order</div>
                <Label>Suma kontrolna</Label>
                <Sel<ChecksumType> value={frame.checksum}
                  onChange={v => setF('checksum', v)}
                  options={[
                    {v:'none',l:'Brak'},{v:'fletcher8',l:'Fletcher8 (2B)'},
                    {v:'crc16',l:'CRC-16 (2B)'},{v:'xor',l:'XOR (1B)'},{v:'sum8',l:'Sum8 (1B)'},
                  ]} />
                <Label>Endianness</Label>
                <Sel<Endian> value={frame.endian} onChange={v => setF('endian', v)}
                  options={[{v:'LE',l:'Little-Endian'},{v:'BE',l:'Big-Endian'}]} />
              </div>
            </div>

            <div>
              <Label>Bajty końcowe trailer (opcjonalne, hex)</Label>
              <Inp
                value={trailerStr}
                onChange={v => setF('trailer', parseTrailerStr(v))}
                placeholder="0D 0A  lub pozostaw puste"
              />
            </div>
          </div>

          {/* 3. Wiadomości */}
          <div>
            <SectionHeader>3. Definicje wiadomości</SectionHeader>
            <div className="space-y-4">
              {messages.map((msg, mi) => (
                <MessageEditor
                  key={mi}
                  idx={mi}
                  entry={msg}
                  onIdChange={v => updateMsgId(mi, v)}
                  onOutputChange={v => updateMsgDef(mi, 'output', v)}
                  onAddField={() => addField(mi)}
                  onRemoveField={fi => removeField(mi, fi)}
                  onUpdateField={(fi, k, v) => updateField(mi, fi, k, v)}
                  onRemove={() => removeMessage(mi)}
                />
              ))}
              <Btn onClick={addMessage} variant="primary">+ Dodaj wiadomość</Btn>
            </div>
          </div>

          {/* Podpowiedź pól */}
          <FieldHints />

          {/* 4. Eksport */}
          <div>
            <SectionHeader>4. Generuj</SectionHeader>
            <div className="flex gap-2 flex-wrap mb-3">
              <button
                onClick={handleLoadNow}
                className="px-3 py-1.5 rounded text-[10px] border border-[#238636] bg-[#238636]/20 text-[#3fb950] hover:bg-[#238636]/40 transition-all"
              >
                ▶ Załaduj teraz
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded text-[10px] border border-[#1f6feb] bg-[#1f6feb]/20 text-[#58a6ff] hover:bg-[#1f6feb]/40 transition-all"
              >
                💾 Pobierz .js
              </button>
              <button
                onClick={() => setPreview(p => !p)}
                className="px-3 py-1.5 rounded text-[10px] border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] transition-all"
              >
                {preview ? 'Ukryj' : '👁 Podgląd'} .js
              </button>
            </div>
            {preview && (
              <pre className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[9px] text-[#8b949e] overflow-x-auto max-h-64 overflow-y-auto">
                {generateJs(buildSchema())}
              </pre>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── MessageEditor ─────────────────────────────────────────────────────────────

interface MsgEditorProps {
  idx: number;
  entry: MsgEntry;
  onIdChange: (v: string) => void;
  onOutputChange: (v: OutputType) => void;
  onAddField: () => void;
  onRemoveField: (i: number) => void;
  onUpdateField: <K extends keyof FieldDef>(i: number, k: K, v: FieldDef[K]) => void;
  onRemove: () => void;
}

function MessageEditor({ idx, entry, onIdChange, onOutputChange, onAddField, onRemoveField, onUpdateField, onRemove }: MsgEditorProps) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[#6e7681] text-[9px]">Wiad. #{idx + 1}</div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <Label>ID wiadomości (hex)</Label>
            <input
              value={entry.id}
              onChange={e => onIdChange(e.target.value)}
              className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[10px] text-[#f7c948] font-mono w-full focus:outline-none focus:border-[#58a6ff]"
              placeholder="0x0001"
            />
          </div>
          <div>
            <Label>Typ wyjścia</Label>
            <Sel<OutputType>
              value={entry.def.output}
              onChange={onOutputChange}
              options={[
                {v:'positionFix', l:'Position Fix (lat/lon/alt)'},
                {v:'measurements', l:'Raw Measurements'},
                {v:'observations', l:'Sky Plot (az/el)'},
              ]}
            />
          </div>
        </div>
        <button onClick={onRemove} className="text-[#da3633] hover:text-red-400 text-sm px-1">✕</button>
      </div>

      {/* Tabela pól */}
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] font-mono border-collapse mb-2">
          <thead>
            <tr className="text-[#6e7681] border-b border-[#21262d]">
              <th className="text-left py-1 pr-2 w-24">Nazwa / as</th>
              <th className="text-left py-1 pr-2 w-20">Typ</th>
              <th className="text-left py-1 pr-2 w-16">Offset</th>
              <th className="text-left py-1 pr-2 w-20">Scale</th>
              <th className="text-left py-1 pr-2">Map (JSON)</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {entry.def.fields.map((f, fi) => (
              <FieldRow
                key={fi}
                field={f}
                onChange={(k, v) => onUpdateField(fi, k, v)}
                onRemove={() => onRemoveField(fi)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Btn onClick={onAddField}>+ Dodaj pole</Btn>
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ field, onChange, onRemove }: {
  field: FieldDef;
  onChange: <K extends keyof FieldDef>(k: K, v: FieldDef[K]) => void;
  onRemove: () => void;
}) {
  const mapStr = field.map ? JSON.stringify(field.map) : '';

  function handleMap(s: string) {
    if (!s.trim()) { onChange('map', undefined); return; }
    try { onChange('map', JSON.parse(s) as Record<number, string>); } catch { /* ignore */ }
  }

  return (
    <tr className="border-b border-[#21262d]">
      <td className="py-0.5 pr-1">
        <input value={field.name} onChange={e => onChange('name', e.target.value)}
          className="bg-transparent border-b border-[#30363d] text-[#e6edf3] w-full focus:outline-none focus:border-[#58a6ff] text-[9px] font-mono px-0"
          placeholder="name" />
        <input value={field.as ?? ''} onChange={e => onChange('as', e.target.value || undefined)}
          className="bg-transparent border-b border-[#21262d] text-[#6e7681] w-full focus:outline-none text-[8px] font-mono px-0 mt-0.5"
          placeholder="as (opcj.)" />
      </td>
      <td className="py-0.5 pr-1">
        <select value={field.type} onChange={e => onChange('type', e.target.value as FieldType)}
          className="bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[9px] text-[#e6edf3] font-mono w-full focus:outline-none">
          {(['u8','u16','u32','i8','i16','i32','f32','f64'] as FieldType[]).map(t =>
            <option key={t} value={t}>{t}</option>
          )}
        </select>
      </td>
      <td className="py-0.5 pr-1">
        <input type="number" value={field.offset}
          onChange={e => onChange('offset', parseInt(e.target.value) || 0)}
          className="bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[9px] text-[#e6edf3] font-mono w-16 focus:outline-none" />
      </td>
      <td className="py-0.5 pr-1">
        <input type="number" value={field.scale ?? ''}
          onChange={e => onChange('scale', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[9px] text-[#e6edf3] font-mono w-20 focus:outline-none"
          placeholder="1e-7" />
      </td>
      <td className="py-0.5 pr-1">
        <input value={mapStr}
          onChange={e => handleMap(e.target.value)}
          className="bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[9px] text-[#e6edf3] font-mono w-full focus:outline-none"
          placeholder={`{"0":"none","1":"2d"}`} />
      </td>
      <td className="py-0.5">
        <button onClick={onRemove} className="text-[#da3633] hover:text-red-400 text-[10px]">✕</button>
      </td>
    </tr>
  );
}

// ── Podpowiedź standardowych nazw pól ─────────────────────────────────────────

function FieldHints() {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[8px] font-mono text-[#6e7681]">
      <div className="text-[#8b949e] mb-1 text-[9px]">Standardowe nazwy pól wyjściowych:</div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[#f7c948] mb-0.5">positionFix</div>
          <div>lat · lon · alt</div>
          <div>hdop (opcj.)</div>
          <div>fixType → map:</div>
          <div className="text-[#484f58]">{`{0:"none",1:"2d",2:"3d",3:"dgps"}`}</div>
        </div>
        <div>
          <div className="text-[#f7c948] mb-0.5">measurements</div>
          <div>tow · week · prn</div>
          <div>system → map:</div>
          <div className="text-[#484f58]">{`{0:"gps",2:"galileo",6:"glonass"}`}</div>
          <div>pseudorange · snr</div>
          <div>doppler · freqBand</div>
          <div>freqBand → map:</div>
          <div className="text-[#484f58]">{`{0:"L1",1:"L2",2:"L5"}`}</div>
        </div>
        <div>
          <div className="text-[#f7c948] mb-0.5">observations</div>
          <div>prnNum (liczba)</div>
          <div>system (j.w.)</div>
          <div>azimuth · elevation</div>
          <div>snr · used</div>
          <div>used → map:</div>
          <div className="text-[#484f58]">{`{0:"false",1:"true"}`}</div>
        </div>
      </div>
    </div>
  );
}
