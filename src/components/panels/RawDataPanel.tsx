import { useReceiverStore } from '../../store/receiverStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';

const MAX_ROWS = 50;

function SnrBar({ snr }: { snr: number }) {
  const pct = Math.min(100, (snr / 55) * 100);
  const color = snr >= 40 ? '#3fb950' : snr >= 25 ? '#f7c948' : '#da3633';
  return (
    <div className="flex items-center gap-1">
      <div className="w-10 h-2 bg-[#21262d] rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span style={{ color }} className="text-[9px] font-mono">{snr}</span>
    </div>
  );
}

export function RawDataPanel() {
  const measurements = useReceiverStore(s => s.recentMeasurements);
  const rows = measurements.slice(-MAX_ROWS).reverse();

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
      <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2 font-mono">
        Raw Measurements ({Math.min(rows.length, MAX_ROWS)})
      </div>
      {rows.length === 0 ? (
        <div className="text-[#484f58] text-[9px] font-mono">
          Brak danych — wczytaj plik .ubx
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono border-collapse">
            <thead>
              <tr className="text-[#6e7681] border-b border-[#21262d]">
                <th className="text-left py-1 pr-2">PRN</th>
                <th className="text-left py-1 pr-2">Sys</th>
                <th className="text-right py-1 pr-2">TOW [s]</th>
                <th className="text-right py-1 pr-2">Pseudoodl. [m]</th>
                <th className="text-left py-1 pr-2">C/N₀</th>
                <th className="text-right py-1 pr-2">Doppler</th>
                <th className="text-left py-1">Pasmo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const color = GNSS_SYSTEMS[m.system]?.color ?? '#8b949e';
                return (
                  <tr key={i} className="border-b border-[#161b22] hover:bg-[#161b22]">
                    <td className="py-0.5 pr-2">
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
                      <span style={{ color }}>{m.system.slice(0, 1).toUpperCase()}{String(m.prn).padStart(2, '0')}</span>
                    </td>
                    <td className="py-0.5 pr-2 text-[#6e7681]">{m.system.slice(0, 3).toUpperCase()}</td>
                    <td className="py-0.5 pr-2 text-right text-[#e6edf3]">{m.tow.toFixed(2)}</td>
                    <td className="py-0.5 pr-2 text-right text-[#e6edf3]">{m.pseudorange.toFixed(1)}</td>
                    <td className="py-0.5 pr-2"><SnrBar snr={m.snr} /></td>
                    <td className="py-0.5 pr-2 text-right text-[#6e7681]">
                      {m.doppler != null ? m.doppler.toFixed(1) : '—'}
                    </td>
                    <td className="py-0.5 text-[#8b949e]">{m.freqBand}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
