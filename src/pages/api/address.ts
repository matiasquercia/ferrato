import type { APIRoute } from 'astro';
import { addressFormatError, matchToSuggestion, suggestAddress, verifyAddress } from '@/lib/address';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim() ?? '';
  const suggest = url.searchParams.get('suggest') === '1';

  if (suggest) {
    if (query.length < 3) return json({ verified: false, suggestions: [] });
    try {
      if (!addressFormatError(query)) {
        const result = await verifyAddress(query);
        const suggestions = result.matches.map(matchToSuggestion);
        if (!result.ok) {
          return json({ verified: false, error: result.error, matches: result.matches, suggestions });
        }
        return json({
          verified: true,
          normalized: result.match.label,
          match: result.match,
          matches: result.matches,
          suggestions,
        });
      }
      const suggestions = await suggestAddress(query);
      return json({ verified: false, suggestions });
    } catch (err) {
      console.error('[address] No se pudieron sugerir direcciones', err);
      return json({ verified: false, suggestions: [] });
    }
  }

  const result = await verifyAddress(query);
  if (!result.ok) {
    return json({ verified: false, error: result.error, matches: result.matches });
  }
  return json({
    verified: true,
    normalized: result.match.label,
    match: result.match,
    matches: result.matches,
  });
};
