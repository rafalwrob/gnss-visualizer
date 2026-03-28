import { useCelestialStore } from '../../store/celestialStore';

const DESCRIPTIONS: Record<string, { title: string; body: string; color: string }> = {
  vernalEquinox: {
    title: 'Punkt γ — Równonoc wiosenna',
    body: 'Przecięcie ekliptyki z równikiem niebieskim, gdy Słońce przechodzi z półkuli południowej na północną (~20–21 marca). Jest punktem zerowym układu rektascensji (RA=0h) i długości ekliptycznej (λ=0°). Historycznie zwany "Punktem Barana" (γ Arietis), choć wskutek precesji leży obecnie w Rybach.',
    color: '#22c55e',
  },
  autumnalEquinox: {
    title: 'Równonoc jesienna',
    body: 'Drugie przecięcie ekliptyki z równikiem niebieskim (~22–23 września). Słońce przechodzi z półkuli północnej na południową. Rektascensja RA=12h, deklinacja δ=0°. Zwany też "Punktem Wagi".',
    color: '#ef4444',
  },
  summerSolstice: {
    title: 'Przesilenie letnie',
    body: 'Punkt ekliptyki o maksymalnej deklinacji +23,44° (nachylenie osi Ziemi). Słońce osiąga najwyższe położenie nad równikiem ~20–21 czerwca. Rektascensja RA=6h. Tradycyjnie "Punkt Raka" (Zwrotnik Raka).',
    color: '#f97316',
  },
  winterSolstice: {
    title: 'Przesilenie zimowe',
    body: 'Punkt ekliptyki o minimalnej deklinacji −23,44°. Słońce najniżej pod równikiem ~21–22 grudnia. Rektascensja RA=18h. Tradycyjnie "Punkt Koziorożca" (Zwrotnik Koziorożca).',
    color: '#3b82f6',
  },
  ncp: {
    title: 'Biegun Północny Nieba (BPN)',
    body: 'Punkt na sferze niebieskiej leżący na przedłużeniu osi obrotu Ziemi w kierunku północnym. Deklinacja δ=+90°. W epoce J2000 blisko gwiazdy Polaris (α Ursae Minoris, odległość ~0,7°). Wskutek precesji przesuwa się po okręgu co ~26 000 lat.',
    color: '#e6edf3',
  },
  scp: {
    title: 'Biegun Południowy Nieba (BPD)',
    body: 'Przedłużenie osi obrotu Ziemi ku południu. Deklinacja δ=−90°. Brak jasnej gwiazdy polarnej w tej okolicy — najbliższa to Sigma Octantis (δ≈−88,6°), ledwo widoczna gołym okiem.',
    color: '#e6edf3',
  },
  icrsAxes: {
    title: 'Układ ICRS / J2000',
    body: 'International Celestial Reference System — inercjalny układ współrzędnych niebieskich. Oś X wskazuje punkt γ (RA=0h, δ=0°, epoka J2000.0 = 1 stycznia 2000, 12:00 TT). Oś Z wskazuje BPN. Oś Y = Z×X = kierunek RA=6h, δ=0°. Realizowany przez pozycje kwazarów (ICRF).',
    color: '#58a6ff',
  },
  sun: {
    title: 'Słońce — pozycja bieżąca',
    body: `Przybliżona pozycja Słońca na ekliptyce dla daty ${new Date().toLocaleDateString('pl-PL')}. Obliczona z algorytmu niskiej dokładności (~1°). Słońce przemieszcza się wzdłuż ekliptyki o ~1°/dobę, wykonując pełny obieg w ~365,25 dnia.`,
    color: '#fbbf24',
  },
  raCircles: {
    title: 'Okręgi rektascensji (RA)',
    body: 'Wielkie okręgi przechodzące przez oba bieguny niebieskie, analogiczne do południków geograficznych. Rektascensja mierzona jest na wschód od punktu γ w godzinach (0h–24h) lub stopniach (0°–360°). Siatka co 2h = co 30°.',
    color: '#58a6ff',
  },
  decParallels: {
    title: 'Siatka deklinacji (Dec)',
    body: 'Małe okręgi równoległe do równika niebieskiego, analogiczne do równoleżników geograficznych. Deklinacja δ mierzona jest od równika niebieskiego: +90° to BPN, −90° to BPD. Pokazana siatka co ±30° i ±60°.',
    color: '#22c55e',
  },
  equator: {
    title: 'Równik niebieski',
    body: 'Wielki okrąg będący projekcją równika ziemskiego na sferę niebieską. Deklinacja δ=0°. Przecina ekliptykę w dwóch punktach równonocy. W miarę precesji osi Ziemi, równik niebieski przesuwa się względem gwiazd z okredem ~26 000 lat.',
    color: '#00e5ff',
  },
  ecliptic: {
    title: 'Ekliptyka',
    body: 'Pozorna roczna droga Słońca na sferze niebieskiej, wyznaczona przez płaszczyznę orbity Ziemi wokół Słońca. Nachylona o ε=23,44° do równika niebieskiego (nachylenie osi Ziemi). Planety Układu Słonecznego leżą blisko ekliptyki. Pas gwiazdozbiorów wzdłuż ekliptyki to zodiak.',
    color: '#ffd700',
  },
};

export function CelestialInfoPanel() {
  const { activeInfo, setActiveInfo } = useCelestialStore();
  if (!activeInfo) return null;
  const entry = DESCRIPTIONS[activeInfo];
  if (!entry) return null;

  return (
    <div className="flex-shrink-0 flex flex-col border-l border-[#21262d] bg-[#0d1117] w-80">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d] flex-shrink-0">
        <div
          className="text-sm font-bold font-mono"
          style={{ color: entry.color }}
        >
          {entry.title}
        </div>
        <button
          onClick={() => setActiveInfo(null)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors text-lg leading-none"
        >
          x
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div
          className="h-1 rounded-full mb-4"
          style={{ backgroundColor: entry.color, opacity: 0.6 }}
        />
        <p className="text-[#c9d1d9] text-sm font-mono leading-relaxed">
          {entry.body}
        </p>
      </div>
    </div>
  );
}
