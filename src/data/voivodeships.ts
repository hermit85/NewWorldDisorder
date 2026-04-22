// ═══════════════════════════════════════════════════════════
// Voivodeship -> regional capital coords lookup.
// Used by /spot/new when submit_spot needs placeholder coords
// (exact location resolves after the first Pioneer run). Copy
// and coords provided by product; keep in sync with any DB
// region enum changes.
// ═══════════════════════════════════════════════════════════

export interface Voivodeship {
  /** Stable slug — matches submit_spot.p_region values. */
  id: string;
  /** Label shown in the picker. */
  label: string;
  capital: string;
  lat: number;
  lng: number;
}

export const VOIVODESHIPS: readonly Voivodeship[] = [
  { id: 'dolnoslaskie',         label: 'Dolnośląskie',         capital: 'Wrocław',       lat: 51.1079, lng: 17.0385 },
  { id: 'kujawsko-pomorskie',   label: 'Kujawsko-Pomorskie',   capital: 'Bydgoszcz',     lat: 53.1235, lng: 18.0084 },
  { id: 'lubelskie',            label: 'Lubelskie',            capital: 'Lublin',        lat: 51.2465, lng: 22.5684 },
  { id: 'lubuskie',             label: 'Lubuskie',             capital: 'Zielona Góra',  lat: 51.9356, lng: 15.5064 },
  { id: 'lodzkie',              label: 'Łódzkie',              capital: 'Łódź',          lat: 51.7592, lng: 19.4560 },
  { id: 'malopolskie',          label: 'Małopolskie',          capital: 'Kraków',        lat: 50.0647, lng: 19.9450 },
  { id: 'mazowieckie',          label: 'Mazowieckie',          capital: 'Warszawa',      lat: 52.2297, lng: 21.0122 },
  { id: 'opolskie',             label: 'Opolskie',             capital: 'Opole',         lat: 50.6751, lng: 17.9213 },
  { id: 'podkarpackie',         label: 'Podkarpackie',         capital: 'Rzeszów',       lat: 50.0412, lng: 21.9991 },
  { id: 'podlaskie',            label: 'Podlaskie',            capital: 'Białystok',     lat: 53.1325, lng: 23.1688 },
  { id: 'pomorskie',            label: 'Pomorskie',            capital: 'Gdańsk',        lat: 54.3520, lng: 18.6466 },
  { id: 'slaskie',              label: 'Śląskie',              capital: 'Katowice',      lat: 50.2649, lng: 19.0238 },
  { id: 'swietokrzyskie',       label: 'Świętokrzyskie',       capital: 'Kielce',        lat: 50.8661, lng: 20.6286 },
  { id: 'warminsko-mazurskie',  label: 'Warmińsko-Mazurskie',  capital: 'Olsztyn',       lat: 53.7784, lng: 20.4801 },
  { id: 'wielkopolskie',        label: 'Wielkopolskie',        capital: 'Poznań',        lat: 52.4064, lng: 16.9252 },
  { id: 'zachodniopomorskie',   label: 'Zachodniopomorskie',   capital: 'Szczecin',      lat: 53.4285, lng: 14.5528 },
];

export function findVoivodeship(id: string): Voivodeship | null {
  return VOIVODESHIPS.find((v) => v.id === id) ?? null;
}
