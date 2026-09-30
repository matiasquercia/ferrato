import { track, ecommerceItem } from '@/lib/analytics';
import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { BUYER_FIELDS, emptyBuyer, validateBuyer, type Buyer, type BuyerField } from '@/lib/buyer';
import {
  applySuggestion,
  suggestionKindLabel,
  type AddressSuggestion,
} from '@/lib/address';
import { lineKey, $cart, $cartTotal, removeFromCart, setQuantity } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { productImage } from '@/lib/images';
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp';

interface Props {
  freeShippingFrom: number;
}

const DRAFT_KEY = 'ferrato:buyer';
const inputBase =
  'w-full min-h-11 rounded-lg border bg-white px-4 py-3 outline-none focus:ring-2';
const inputOk = 'border-stone-300 focus:border-brand-500 focus:ring-brand-100';
const inputErr = 'border-red-500 focus:border-red-600 focus:ring-red-100';

function loadDraft(): Buyer {
  if (typeof window === 'undefined') return emptyBuyer();
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyBuyer(), ...JSON.parse(raw) } : emptyBuyer();
  } catch {
    return emptyBuyer();
  }
}

export default function CheckoutForm({ freeShippingFrom }: Props) {
  const items = useStore($cart);
  const total = useStore($cartTotal);
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>(emptyBuyer);
  const [touched, setTouched] = useState<Partial<Record<BuyerField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState<'mp' | 'wa' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [verifiedAddress, setVerifiedAddress] = useState('');
  const [addressBusy, setAddressBusy] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const addressRef = useRef<HTMLInputElement>(null);
  const lookupTimer = useRef<number>(0);
  const suggestAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    setBuyer(loadDraft());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(buyer));
  }, [buyer, mounted]);

  if (!mounted) return <p className="py-16 text-center text-steel">Cargando carrito…</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="text-lg">Tu carrito está vacío.</p>
        <a href="/productos" className="btn-dark mt-6">
          Ver productos
        </a>
      </div>
    );
  }

  const validation = validateBuyer(buyer);
  const addressError =
    submitted || touched.address
      ? validation.errors.address ?? (verifiedAddress ? undefined : validation.ok ? 'Confirmá una dirección real de la lista.' : undefined)
      : undefined;
  const showError = (field: BuyerField) =>
    field === 'address' ? addressError : submitted || touched[field] ? validation.errors[field] : undefined;

  const setAddress = (value: string, verified = false) => {
    setBuyer((current) => ({ ...current, address: value }));
    if (verified) {
      setVerifiedAddress(value);
      setSuggestions([]);
      setOpenList(false);
      setActiveIndex(-1);
      return;
    }
    if (value !== verifiedAddress) setVerifiedAddress('');
  };

  const placeCursor = (at: number) => {
    requestAnimationFrame(() => {
      const input = addressRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(at, at);
    });
  };

  const lookupAddress = async (query: string, mode: 'suggest' | 'verify' = 'verify') => {
    const trimmed = query.trim();
    if (mode === 'suggest' && trimmed.length < 3) {
      setSuggestions([]);
      setOpenList(false);
      setActiveIndex(-1);
      return { verified: false as const };
    }
    suggestAbort.current?.abort();
    const abort = new AbortController();
    suggestAbort.current = abort;
    setAddressBusy(true);
    try {
      const suffix = mode === 'suggest' ? '&suggest=1' : '';
      const res = await fetch(`/api/address?q=${encodeURIComponent(query)}${suffix}`, { signal: abort.signal });
      const data = (await res.json()) as {
        verified?: boolean;
        normalized?: string;
        suggestions?: AddressSuggestion[];
        error?: string;
      };
      const options = data.suggestions ?? [];
      setSuggestions(options);
      if (data.verified && data.normalized) {
        setVerifiedAddress(data.normalized);
        if (mode === 'verify' && data.normalized !== query) {
          setBuyer((current) => ({ ...current, address: data.normalized! }));
        }
        setOpenList(options.length > 1);
        setActiveIndex(options.length > 1 ? 0 : -1);
        return { verified: true as const, normalized: data.normalized };
      }
      if (mode === 'verify') setVerifiedAddress('');
      setOpenList(options.length > 0);
      setActiveIndex(options.length > 0 ? 0 : -1);
      return { verified: false as const, error: data.error, suggestions: options };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return { verified: false as const };
      setSuggestions([]);
      if (mode === 'verify') setVerifiedAddress('');
      return { verified: false as const, error: 'No pudimos verificar la dirección. Probá de nuevo.' };
    } finally {
      if (suggestAbort.current === abort) setAddressBusy(false);
    }
  };

  const pickSuggestion = (suggestion: AddressSuggestion) => {
    const next = applySuggestion(buyer.address, suggestion);
    if (suggestion.kind === 'address') {
      setAddress(next, true);
      return;
    }
    setAddress(next);
    setOpenList(false);
    setSuggestions([]);
    setActiveIndex(-1);
    if (suggestion.kind === 'street' && next.endsWith(' ')) placeCursor(next.length);
    if (suggestion.kind === 'locality') {
      window.clearTimeout(lookupTimer.current);
      lookupTimer.current = window.setTimeout(() => lookupAddress(next, 'verify'), 200);
    }
  };

  const update = (field: BuyerField) => (e: { target: { value: string } }) => {
    if (field === 'address') {
      const value = e.target.value;
      setAddress(value);
      window.clearTimeout(lookupTimer.current);
      lookupTimer.current = window.setTimeout(() => lookupAddress(value, 'suggest'), 280);
      return;
    }
    setBuyer((current) => ({ ...current, [field]: e.target.value }));
  };

  const blur = (field: BuyerField) => () => {
    setTouched((current) => ({ ...current, [field]: true }));
    if (field !== 'address') return;
    window.setTimeout(() => setOpenList(false), 120);
    if (buyer.address && !verifiedAddress) lookupAddress(buyer.address, 'verify');
  };

  const onAddressKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (event.key === 'Escape') {
      setOpenList(false);
      return;
    }
    if (!openList || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      pickSuggestion(suggestions[activeIndex]);
    }
  };

  const payload = () => ({
    items: items.map((i) => ({ id: i.id, variant: i.variant, quantity: i.quantity })),
    buyer,
  });

  const focusFirstError = (errors: Partial<Record<BuyerField, string>>) => {
    const first = BUYER_FIELDS.find(({ id }) => errors[id]);
    if (!first) return;
    summaryRef.current?.focus();
    document.getElementById(first.id)?.focus();
  };

  const ensureValid = async () => {
    setSubmitted(true);
    setError(null);
    const next = validateBuyer(buyer);
    if (!next.ok) {
      focusFirstError(next.errors);
      return false;
    }
    const checked = verifiedAddress ? { verified: true as const } : await lookupAddress(buyer.address, 'verify');
    if (!checked.verified) {
      focusFirstError({ address: checked.error ?? 'Confirmá una dirección real de la lista.' });
      return false;
    }
    return true;
  };

  const payWithMercadoPago = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!(await ensureValid())) return;
    submitting.current = true;
    track('begin_checkout', { currency: 'ARS', value: total, items: items.map(ecommerceItem) });
    setLoading('mp');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok || !data.initPoint) throw new Error(data.error ?? 'No se pudo iniciar el pago.');
      track('checkout_submit', { payment_method: 'mercadopago' });
      window.location.href = data.initPoint;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      submitting.current = false;
      track('checkout_error', { stage: 'create_preference' });
      setLoading(null);
    }
  };

  const orderByWhatsApp = async () => {
    if (submitting.current) return;
    if (!(await ensureValid())) return;
    submitting.current = true;
    setLoading('wa');
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
    } catch {
      // El pedido por WhatsApp sigue; Notion es un respaldo.
    }
    track('checkout_submit', { payment_method: 'whatsapp' });
    window.location.href = buildWhatsAppOrderUrl(items, buyer);
  };

  const missingForShipping = Math.max(0, freeShippingFrom - total);
  const visibleErrors = BUYER_FIELDS.filter(({ id }) => showError(id));

  return (
    <div className="checkout-shell">
      <div className="checkout-layout">
        <section aria-label="Productos" className="h-fit rounded-2xl border border-stone-200 bg-white">
          <ul className="divide-y divide-stone-100">
            {items.map((item) => (
              <li key={lineKey(item)} className="flex flex-wrap items-start gap-4 p-5">
                <img
                  src={productImage(item.image, 160)}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 shrink-0 rounded-xl bg-brand-50 object-cover"
                />
                <div className="min-w-0 flex-1 basis-48">
                  <a href={`/productos/${item.slug}`} className="font-semibold hover:text-brand-700">
                    {item.name}
                    {item.variant && (
                      <span className="block text-xs font-normal text-steel">{item.variant}</span>
                    )}
                  </a>
                  <p className="text-sm text-steel">{formatPrice(item.price)} c/u</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-stone-300">
                      <button
                        type="button"
                        className="min-h-11 min-w-11 px-3"
                        onClick={() => setQuantity(lineKey(item), item.quantity - 1)}
                        aria-label="Restar"
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        className="min-h-11 min-w-11 px-3"
                        onClick={() => setQuantity(lineKey(item), item.quantity + 1)}
                        aria-label="Sumar"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeFromCart(lineKey(item))}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                <span className="ml-auto text-lg font-bold">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-stone-200 p-5">
            <p className="text-sm text-steel">
              {missingForShipping > 0
                ? `Te faltan ${formatPrice(missingForShipping)} para tener envío gratis.`
                : '¡Tenés envío gratis!'}
            </p>
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </section>

        <form onSubmit={payWithMercadoPago} noValidate className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="font-display text-2xl font-bold uppercase">Tus datos</h2>
          <p className="text-sm text-steel">Los campos con * son obligatorios para coordinar el envío.</p>

          {submitted && visibleErrors.length > 0 && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <p className="font-semibold">Revisá estos datos:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {visibleErrors.map(({ id, label }) => (
                  <li key={id}>
                    <a href={`#${id}`} className="underline">
                      {label}: {validation.errors[id]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-semibold">
              Nombre y apellido <span className="text-red-700">*</span>
            </label>
            <input
              id="name"
              className={`${inputBase} ${showError('name') ? inputErr : inputOk}`}
              autoComplete="name"
              value={buyer.name}
              onChange={update('name')}
              onBlur={blur('name')}
              aria-invalid={Boolean(showError('name'))}
              aria-describedby={showError('name') ? 'name-error' : undefined}
            />
            {showError('name') && (
              <p id="name-error" className="mt-1 text-sm text-red-700">
                {showError('name')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold">
              Email <span className="text-red-700">*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`${inputBase} ${showError('email') ? inputErr : inputOk}`}
              autoComplete="email"
              inputMode="email"
              value={buyer.email}
              onChange={update('email')}
              onBlur={blur('email')}
              aria-invalid={Boolean(showError('email'))}
              aria-describedby={showError('email') ? 'email-error' : undefined}
            />
            {showError('email') && (
              <p id="email-error" className="mt-1 text-sm text-red-700">
                {showError('email')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold">
              Teléfono <span className="text-red-700">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              className={`${inputBase} ${showError('phone') ? inputErr : inputOk}`}
              autoComplete="tel"
              inputMode="tel"
              value={buyer.phone}
              onChange={update('phone')}
              onBlur={blur('phone')}
              aria-invalid={Boolean(showError('phone'))}
              aria-describedby={showError('phone') ? 'phone-error' : 'phone-hint'}
            />
            {showError('phone') ? (
              <p id="phone-error" className="mt-1 text-sm text-red-700">
                {showError('phone')}
              </p>
            ) : (
              <p id="phone-hint" className="mt-1 text-xs text-steel">
                Con código de área, por ejemplo 11 3100 8720.
              </p>
            )}
          </div>

          <div className="relative">
            <label htmlFor="address" className="mb-1 block text-sm font-semibold">
              Dirección y localidad <span className="text-red-700">*</span>
            </label>
            <input
              ref={addressRef}
              id="address"
              role="combobox"
              aria-expanded={openList}
              aria-controls="address-list"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `address-option-${activeIndex}` : undefined}
              className={`${inputBase} ${showError('address') ? inputErr : inputOk}`}
              autoComplete="off"
              spellCheck={false}
              value={buyer.address}
              onChange={update('address')}
              onBlur={blur('address')}
              onFocus={() => suggestions.length > 0 && setOpenList(true)}
              onKeyDown={onAddressKeyDown}
              aria-invalid={Boolean(showError('address'))}
              aria-describedby={showError('address') ? 'address-error' : 'address-hint'}
            />
            {openList && suggestions.length > 0 && (
              <ul
                id="address-list"
                role="listbox"
                className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.id}
                    id={`address-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button
                      type="button"
                      className={`flex min-h-11 w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-50 ${
                        index === activeIndex ? 'bg-brand-50' : ''
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pickSuggestion(suggestion)}
                    >
                      <span className="mt-0.5 w-16 shrink-0 text-[11px] font-medium text-steel">
                        {suggestionKindLabel(suggestion.kind)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{suggestion.title}</span>
                        {suggestion.subtitle && (
                          <span className="block text-xs text-steel">{suggestion.subtitle}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="sr-only" aria-live="polite">
              {openList && suggestions.length > 0
                ? `${suggestions.length} sugerencias de dirección`
                : addressBusy
                  ? 'Buscando calles y localidades'
                  : ''}
            </p>
            {showError('address') ? (
              <p id="address-error" className="mt-1 text-sm text-red-700">
                {showError('address')}
              </p>
            ) : verifiedAddress ? (
              <p id="address-hint" className="mt-1 text-xs text-green-700">
                Dirección verificada: {verifiedAddress}
              </p>
            ) : (
              <p id="address-hint" className="mt-1 text-xs text-steel">
                {addressBusy
                  ? 'Buscando calles y localidades…'
                  : 'Empezá por la calle: te sugerimos coincidencias. Completá con número y localidad.'}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-semibold">
              Notas del pedido
            </label>
            <textarea
              id="notes"
              className={`${inputBase} ${showError('notes') ? inputErr : inputOk}`}
              rows={2}
              maxLength={500}
              value={buyer.notes}
              onChange={update('notes')}
              onBlur={blur('notes')}
              aria-invalid={Boolean(showError('notes'))}
              aria-describedby={showError('notes') ? 'notes-error' : undefined}
            />
            {showError('notes') && (
              <p id="notes-error" className="mt-1 text-sm text-red-700">
                {showError('notes')}
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={Boolean(loading)}
            className="btn w-full bg-[#009ee3] text-white hover:bg-[#0086c3]"
          >
            {loading === 'mp' ? 'Redirigiendo…' : 'Pagar con Mercado Pago'}
          </button>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" /> o <span className="h-px flex-1 bg-stone-200" />
          </div>
          <button
            type="button"
            disabled={Boolean(loading)}
            onClick={orderByWhatsApp}
            className="btn-whatsapp w-full"
          >
            {loading === 'wa' ? 'Abriendo WhatsApp…' : 'Pedir por WhatsApp'}
          </button>
          <p className="text-xs text-steel">
            Usamos tus datos para gestionar el pedido.{' '}
            <a href="/privacidad" className="underline">
              Consultá nuestra política de privacidad
            </a>
            .
          </p>
          <p className="text-center text-xs text-steel">
            Pagá con tarjeta, en cuotas, con dinero en cuenta o efectivo.
          </p>
        </form>
      </div>
    </div>
  );
}
