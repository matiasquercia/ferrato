export interface AddressMatch {
  label: string;
  street: string;
  number: number;
  locality: string;
  province: string;
}

export type AddressSuggestionKind = 'street' | 'locality' | 'address';

export interface AddressSuggestion {
  kind: AddressSuggestionKind;
  id: string;
  title: string;
  subtitle: string;
  value: string;
  street?: string;
  number?: number;
  locality?: string;
  province?: string;
}

const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api';
const GEOREF_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Ferrato (ventas@ferrato.com.ar)',
};

const KIND_ORDER: Record<AddressSuggestionKind, number> = {
  address: 0,
  street: 1,
  locality: 2,
};

type StreetRow = {
  id?: string;
  nombre?: string;
  categoria?: string;
  nomenclatura?: string;
  localidad_censal?: { nombre?: string };
  provincia?: { nombre?: string };
};

type LocalityRow = {
  id?: string;
  nombre?: string;
  provincia?: { nombre?: string };
};

export function addressFormatError(value: string): string | null {
  const v = value.trim();
  if (v.length < 8) return 'Indicá calle, número y localidad para el envío.';
  if (!/[a-záéíóúüñ]/i.test(v)) return 'Escribí el nombre de la calle.';
  if (!/\d/.test(v)) return 'Falta el número de la calle.';
  if (!/,/.test(v) && v.split(/\s+/).length < 3) {
    return 'Incluí también la localidad, por ejemplo Av. Corrientes 1234, CABA.';
  }
  return null;
}

export function parseAddressQuery(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const comma = trimmed.lastIndexOf(',');
  if (comma === -1) return { direccion: trimmed, lugar: '' };
  return {
    direccion: trimmed.slice(0, comma).trim(),
    lugar: trimmed.slice(comma + 1).trim(),
  };
}

export function splitStreetAndNumber(direccion: string) {
  const trimmed = direccion.trim().replace(/\s+/g, ' ');
  const match = trimmed.match(/^(.*?)(?:\s+(\d{1,6}))$/);
  if (!match) return { street: trimmed, number: '' };
  const street = match[1].trim();
  const letters = street.replace(/[^a-záéíóúüñ]/gi, '').length;
  if (letters < 3) return { street: trimmed, number: '' };
  return { street, number: match[2] };
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function labelsMatch(a: string, b: string) {
  return normalize(a) === normalize(b);
}

export function prettyLocality(locality: string, province = '') {
  const loc = locality.trim();
  const haystack = normalize(`${loc} ${province}`);
  if (/ciudad autonoma de buenos aires/.test(haystack) || /^comuna \d+/.test(haystack)) {
    return 'CABA';
  }
  return loc;
}

export function aliasLocalities(query: string): AddressSuggestion[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const caba = normalize('Ciudad Autónoma de Buenos Aires');
  const aliases = ['caba', 'c a b a', 'capital federal', 'cap fed'];
  const hitsCaba =
    aliases.some((alias) => alias.startsWith(q) || (q.length >= 3 && q.startsWith(alias))) ||
    (q.length >= 4 && (caba.startsWith(q) || q.startsWith('ciudad autonoma')));
  if (!hitsCaba) return [];
  return [
    {
      kind: 'locality',
      id: 'locality:caba',
      title: 'CABA',
      subtitle: 'Ciudad Autónoma de Buenos Aires',
      value: 'CABA',
      locality: 'CABA',
      province: 'Ciudad Autónoma de Buenos Aires',
    },
  ];
}

export function applySuggestion(current: string, suggestion: AddressSuggestion): string {
  if (suggestion.kind === 'address') return suggestion.value;
  const { direccion } = parseAddressQuery(current);
  const { number } = splitStreetAndNumber(direccion);

  if (suggestion.kind === 'street') {
    const name = suggestion.street ?? suggestion.title;
    const locality = suggestion.locality ?? '';
    if (number) return locality ? `${name} ${number}, ${locality}` : `${name} ${number}`;
    return `${name} `;
  }

  const locality = suggestion.locality ?? suggestion.title;
  if (!direccion) return locality;
  return `${direccion}, ${locality}`;
}

function cityScore(locality: string, province: string) {
  const haystack = normalize(`${locality} ${province}`);
  if (haystack.includes('ciudad autonoma de buenos aires') || haystack === 'caba' || haystack.startsWith('caba ')) {
    return 100;
  }
  if (haystack.includes('rosario')) return 72;
  if (haystack.includes('cordoba')) return 70;
  if (haystack.includes('mendoza')) return 60;
  if (haystack.includes('la plata')) return 55;
  if (haystack.includes('mar del plata')) return 50;
  return 0;
}

export function rankAndDedupeStreets(rows: StreetRow[]): StreetRow[] {
  const seen = new Set<string>();
  const unique: StreetRow[] = [];
  for (const row of rows) {
    const street = row.nombre?.trim() ?? '';
    const locality = prettyLocality(row.localidad_censal?.nombre ?? '', row.provincia?.nombre ?? '');
    if (!street || !locality) continue;
    const key = `${normalize(street)}|${normalize(locality)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique.sort((a, b) => {
    const aLoc = prettyLocality(a.localidad_censal?.nombre ?? '', a.provincia?.nombre ?? '');
    const bLoc = prettyLocality(b.localidad_censal?.nombre ?? '', b.provincia?.nombre ?? '');
    const aScore =
      cityScore(aLoc, a.provincia?.nombre ?? '') + (/^av\b/i.test(a.nombre ?? '') || a.categoria === 'AV' ? 8 : 0);
    const bScore =
      cityScore(bLoc, b.provincia?.nombre ?? '') + (/^av\b/i.test(b.nombre ?? '') || b.categoria === 'AV' ? 8 : 0);
    return bScore - aScore;
  });
}

function uniqueSuggestions(rows: AddressSuggestion[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function kindLabel(kind: AddressSuggestionKind) {
  if (kind === 'street') return 'Calle';
  if (kind === 'locality') return 'Localidad';
  return 'Dirección';
}

export function suggestionKindLabel(kind: AddressSuggestionKind) {
  return kindLabel(kind);
}

function streetToSuggestion(row: StreetRow): AddressSuggestion | null {
  const street = row.nombre?.trim() ?? '';
  const province = row.provincia?.nombre?.trim() ?? '';
  const locality = prettyLocality(row.localidad_censal?.nombre ?? '', province);
  if (!street || !locality) return null;
  return {
    kind: 'street',
    id: `street:${normalize(street)}:${normalize(locality)}`,
    title: street,
    subtitle: province && locality !== 'CABA' && locality !== province ? `${locality}, ${province}` : locality,
    value: `${street} `,
    street,
    locality,
    province,
  };
}

function localityToSuggestion(row: LocalityRow): AddressSuggestion | null {
  const name = row.nombre?.trim() ?? '';
  const province = row.provincia?.nombre?.trim() ?? '';
  if (!name) return null;
  const locality = prettyLocality(name, province);
  return {
    kind: 'locality',
    id: `locality:${row.id ?? normalize(locality)}`,
    title: locality,
    subtitle: province && locality !== province ? province : '',
    value: locality,
    locality,
    province,
  };
}

export function matchToSuggestion(match: AddressMatch): AddressSuggestion {
  const locality = prettyLocality(match.locality, match.province);
  return {
    kind: 'address',
    id: `address:${match.label}`,
    title: `${match.street} ${match.number}`,
    subtitle: locality === match.province ? locality : `${locality}, ${match.province}`,
    value: match.label,
    street: match.street,
    number: match.number,
    locality,
    province: match.province,
  };
}

async function georefGet<T>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`${GEOREF_BASE}/${path}?${params}`, { headers: GEOREF_HEADERS });
  if (!response.ok) throw new Error(`Georef ${response.status}`);
  return response.json() as Promise<T>;
}

function toMatch(row: {
  nomenclatura?: string;
  calle?: { nombre?: string };
  altura?: { valor?: number | null };
  localidad_censal?: { nombre?: string };
  provincia?: { nombre?: string };
}): AddressMatch | null {
  const number = row.altura?.valor;
  const street = row.calle?.nombre?.trim();
  const locality = row.localidad_censal?.nombre?.trim();
  const province = row.provincia?.nombre?.trim();
  const label = row.nomenclatura?.trim();
  if (!label || !street || !locality || !province || number == null) return null;
  return { label, street, number, locality, province };
}

export async function lookupAddress(query: string): Promise<AddressMatch[]> {
  const { direccion, lugar } = parseAddressQuery(query);
  const params = new URLSearchParams({
    direccion,
    max: '6',
    campos: 'nomenclatura,calle.nombre,altura.valor,localidad_censal.nombre,provincia.nombre',
  });
  if (lugar) params.set('localidad', lugar);

  const data = await georefGet<{ direcciones?: Parameters<typeof toMatch>[0][] }>('direcciones', params);
  const matches = (data.direcciones ?? []).map(toMatch).filter((row): row is AddressMatch => row !== null);
  const seen = new Set<string>();
  return matches.filter((row) => {
    if (seen.has(row.label)) return false;
    seen.add(row.label);
    return true;
  });
}

async function searchStreets(nombre: string, provincia?: string): Promise<AddressSuggestion[]> {
  if (nombre.trim().length < 3) return [];
  const params = new URLSearchParams({
    nombre,
    max: provincia ? '8' : '15',
    campos: 'id,nombre,categoria,nomenclatura,localidad_censal.nombre,provincia.nombre',
  });
  if (provincia) params.set('provincia', provincia);
  const data = await georefGet<{ calles?: StreetRow[] }>('calles', params);
  return rankAndDedupeStreets(data.calles ?? [])
    .map(streetToSuggestion)
    .filter((row): row is AddressSuggestion => row !== null);
}

async function searchLocalities(nombre: string): Promise<AddressSuggestion[]> {
  if (nombre.trim().length < 2) return [];
  const params = new URLSearchParams({
    nombre,
    max: '8',
    campos: 'id,nombre,provincia.nombre',
  });
  const data = await georefGet<{ localidades_censales?: LocalityRow[] }>('localidades-censales', params);
  return (data.localidades_censales ?? [])
    .map(localityToSuggestion)
    .filter((row): row is AddressSuggestion => row !== null);
}

export async function suggestAddress(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const { direccion, lugar } = parseAddressQuery(query);
  const { street, number } = splitStreetAndNumber(direccion);

  if (lugar) {
    const [localities, addresses] = await Promise.all([
      searchLocalities(lugar),
      number ? lookupAddress(query).then((rows) => rows.map(matchToSuggestion)) : Promise.resolve([]),
    ]);
    const aliases = aliasLocalities(lugar).map((row) => ({
      ...row,
      value: applySuggestion(query, row),
    }));
    const localityRows = [...aliases, ...localities].map((row) => ({
      ...row,
      value: `${direccion}, ${row.locality ?? row.title}`,
    }));
    return uniqueSuggestions([...addresses, ...localityRows])
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
      .slice(0, 8);
  }

  if (number) {
    return (await lookupAddress(query)).map(matchToSuggestion);
  }

  const [cabaStreets, streets] = await Promise.all([searchStreets(street, 'caba'), searchStreets(street)]);
  return uniqueSuggestions([...cabaStreets, ...streets]).slice(0, 8);
}

export function resolveAddress(query: string, matches: AddressMatch[]) {
  const exact = matches.find((row) => labelsMatch(query, row.label));
  if (exact) return { ok: true as const, match: exact, matches };
  if (matches.length === 1) return { ok: true as const, match: matches[0], matches };
  if (matches.length === 0) {
    return {
      ok: false as const,
      matches,
      error:
        'No encontramos esa dirección. Escribí calle, número y localidad, por ejemplo Av. Corrientes 1234, CABA.',
    };
  }
  return {
    ok: false as const,
    matches,
    error: 'Hay varias coincidencias. Elegí tu localidad de la lista.',
  };
}

export async function verifyAddress(query: string) {
  const format = addressFormatError(query);
  if (format) return { ok: false as const, error: format, matches: [] as AddressMatch[] };
  try {
    const matches = await lookupAddress(query);
    const resolved = resolveAddress(query, matches);
    if (!resolved.ok) return resolved;
    return { ok: true as const, match: resolved.match, matches };
  } catch (err) {
    console.error('[address] No se pudo verificar la dirección', err);
    return {
      ok: false as const,
      matches: [] as AddressMatch[],
      error: 'No pudimos verificar la dirección en este momento. Probá de nuevo en unos segundos.',
    };
  }
}
