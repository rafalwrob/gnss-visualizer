import { useReceiverStore } from '../../store/receiverStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';

const MAX_ROWS = 50;

function SnrBar({ snr }: { snr: number }) {
  const pct = Math.min(100, (snr / 55) * 100);
  const color = snr >= 40 ? '#3fb950' : snr >= 25 ? '#f7c948' : '#da3633';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-2.5 bg-[#21262d] rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span style={{ color }} className="text-xs font-mono tabular-nums w-6">{snr}</span>
    </div>
  );
}

export function RawDataPanel() {
  const measurements = useReceiverStore(s => s.recentMeasurements);
  const rows = measurements.slice(-MAX_ROWS).reverse();

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-3 font-mono">
        Raw Measurements
        {rows.length > 0 && <span className="ml-2 text-[#484f58] normal-case tracking-normal">({rows.length})</span>}
      </div>
      {rows.length === 0 ? (
        <div className="text-[#484f58] text-sm font-mono py-4 text-center">
          Brak danych — wczytaj plik .ubx lub podłącz odbiornik
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="text-[#6e7681] border-b border-[#21262d]">
                <th className="text-left py-2 pr-3 font-medium">PRN</th>
                <th className="text-left py-2 pr-3 font-medium">Sys</th>
                <th className="text-right py-2 pr-3 font-medium">TOW [s]</th>
                <th className="text-right py-2 pr-3 font-medium">Pseudoodl. [m]</th>
                <th className="text-left py-2 pr-3 font-medium">C/N₀</th>
                <th className="text-right py-2 pr-3 font-medium">Doppler</th>
                <th className="text-left py-2 font-medium">Pasmo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const color = GNSS_SYSTEMS[m.system]?.color ?? '#8b949e';
                const prnStr = m.system.slice(0, 1).toUpperCase() + String(m.prn).padStart(2, '0');
                return (
                  <tr key={i} className="border-b border-[#161b22] hover:bg-[#161b22] transition-colors">
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span style={{ color }} className="font-bold">{prnStr}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-[#6e7681]">{m.system.slice(0, 3).toUpperCase()}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{m.tow.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{m.pseudorange.toFixed(1)}</td>
                    <td className="py-1.5 pr-3"><SnrBar snr={m.snr} /></td>
                    <td className="py-1.5 pr-3 text-right text-[#6e7681] tabular-nums">
                      {m.doppler != null ? m.doppler.toFixed(1) : '—'}
                    </td>
                    <td className="py-1.5 text-[#8b949e]">{m.freqBand}</td>
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
