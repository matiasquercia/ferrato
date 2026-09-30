import type { APIRoute } from 'astro';
import {
  matchToSuggestion,
  suggestLocalities,
  suggestStreets,
  verifyAddress,
  verifyLocality,
  verifyPostalCode,
} from '@/lib/address';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const type = url.searchParams.get('type')?.trim() ?? '';
  const query = url.searchParams.get('q')?.trim() ?? '';
  const street = url.searchParams.get('street')?.trim() ?? '';
  const locality = url.searchParams.get('locality')?.trim() ?? '';
  const province = url.searchParams.get('province')?.trim() ?? '';

  try {
    if (type === 'street') {
      if (query.length < 3) return json({ verified: false, suggestions: [] });
      return json({ verified: false, suggestions: await suggestStreets(query, locality) });
    }
    if (type === 'locality') {
      if (query.length < 2) return json({ verified: false, suggestions: [] });
      return json({ verified: false, suggestions: await suggestLocalities(query) });
    }
    if (type === 'verify-locality') {
      const result = await verifyLocality(query || locality);
      if (!result.ok) {
        return json({ verified: false, field: 'locality', error: result.error, suggestions: result.suggestions });
      }
      return json({
        verified: true,
        field: 'locality',
        locality: result.locality,
        province: result.province,
        suggestions: result.suggestions,
      });
    }
    if (type === 'postal') {
      const result = await verifyPostalCode(query, locality, province);
      if (!result.ok) {
        return json({ verified: false, field: 'postalCode', error: result.error, places: result.places });
      }
      return json({
        verified: true,
        field: 'postalCode',
        postalCode: result.postalCode,
        places: result.places,
      });
    }

    const result = await verifyAddress(street || query, locality);
    const suggestions = result.matches.map(matchToSuggestion);
    if (!result.ok) {
      const field = /localidad|coincidencias/i.test(result.error) ? 'locality' : 'street';
      return json({ verified: false, field, error: result.error, matches: result.matches, suggestions });
    }
    return json({
      verified: true,
      field: 'street',
      normalized: result.match.label,
      match: result.match,
      matches: result.matches,
      suggestions,
    });
  } catch (err) {
    console.error('[address] No se pudieron sugerir direcciones', err);
    return json({ verified: false, suggestions: [] });
  }
};
