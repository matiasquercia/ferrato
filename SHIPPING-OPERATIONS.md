# Envíos Ferralto

No se activó ninguna tarifa numérica: faltan paquetes embalados, acuerdos de transporte y cargos efectivos de cobro. El usuario confirmó posibles orígenes CP 1419, CP 1609 y Caseros (1678 en el cotizador); falta asignar el origen por pedido. La tienda solicita cotización antes del pago y no promete envío gratis por monto de compra.

## Precio protegido

Costo C = transporte final + embalaje + seguro + manipulación, para el pedido completo.
Reserva propuesta b = 10%; margen neto mínimo propuesto m = 10% del cobro; ganancia mínima propuesta g = ARS 1.000 por pedido. Son parámetros editables; no tarifas de transportistas. Comisión e impuestos sobre el cobro f deben conocerse: no se supone cero.

Precio = redondear hacia arriba a ARS 100 el máximo de C×(1+b)/(1-f-m) y [C×(1+b)+g]/(1-f).

Esto conserva el margen mínimo frente a los costos cargados y la reserva indicada. No garantiza cubrir cualquier aumento, un paquete mal medido, devoluciones o cargos omitidos. Debe verificarse el costo completo antes de confirmar la venta.

## Tarifas privadas

Cargar `SHIPPING_CONFIG_JSON` como configuración secreta de Cloudflare. Nunca guardarla en archivos públicos ni variables PUBLIC_. Estructura:

```json
{
  "policy": {
    "contingencyRate": 0.10, "netMarginRate": 0.10,
    "minimumProfit": 1000, "collectionRate": null, "roundTo": 100
  },
  "rates": []
}
```

Cada tarifa necesita id, carrier, originPostalCode, destinationPostalCodes (códigos numéricos exactos), destinationLocalities (nombre normalizado tal como lo devuelve Georef), verifiedAt y validUntil (ISO UTC, vigencia máxima siete días), source (cotización verificable), quantities (máximo de unidades por SKU del catálogo), packagesVerified=true y carrierCost/packagingCost/insuranceCost/handlingCost finales en ARS, incluidos impuestos. No dejar un componente desconocido en cero.

La cotización debe cubrir cualquier combinación del sobre de cantidades del pedido completo. No reutilizar una cotización individual para varios bultos. Si no cubre una combinación, crear un sobre más estrecho; si no hay sobre verificado, cotizar por WhatsApp. Las variantes del mismo SKU se suman para evaluar el máximo. No se autoriza el pago con tarifa vencida o desconocida; al pagar se vuelve a calcular y se exige coincidencia con lo visto por el cliente.

Los pedidos de WhatsApp con envío pendiente se registran como subtotal de productos; el texto indica explícitamente que falta el total final. No interpretar ese subtotal como una venta cobrada con envío incluido.

## Fuentes consultadas 30/09/2026

- Vía Cargo: https://formularios.viacargo.com.ar/ — consulta informativa de 1419 a 1609 y de 1419 a 1043, escalera 5 plegada de 170×51×7 cm y 8,8 kg; valor declarado ARS 100.000, mínimo del cotizador. Ambos resultados: puerta a puerta ARS 31.000,01, agencia/domicilio ARS 22.000 y agencia/agencia ARS 14.000. No usar para otro paquete o ruta, ni asumir embalaje incluido. No se cargó al checkout.
- Mercado Pago: https://www.mercadopago.com.ar/herramientas-para-vender/check-out — referencia pública 6,29% + IVA al instante, con variaciones según provincia, medio de pago y plazo. No es la comisión efectiva verificada de Ferralto.
- Andreani: https://www.andreani.com/?tab=cotizar-envio — requiere CP de origen/destino y peso/medidas; pendiente cotización aplicable.
- Correo Argentino: https://integracion.correoargentino.com.ar/terms — límites publicados de PAQ.AR y tarifas por acuerdo. No elegir servicio sin cotejar paquetes.
- Retroflet: https://retroflet.com.ar/ — furgón ARS 32.300/h, mínimo dos horas; base CABA, Vicente López, San Isidro, General San Martín y Tres de Febrero. Fuera de esa área indica ARS 3.050/km de ida adicionales. Referencia de flete dedicado, no costo por entrega consolidada ni tarifa cargada al checkout.

Los pesos de escaleras y banquetas fueron confirmados por el usuario. Las medidas aportadas no se asumieron como dimensiones embaladas. Verificar tres dimensiones, peso bruto y cantidad de bultos para cada SKU.

## Referencia orientativa solicitada por el usuario

Hasta el 03/10/2026, una escalera SAF-2005 hacia CABA CP 1043 o Boulogne CP 1609 puede mostrar ARS 49.900 orientativos puerta a puerta desde CP 1419. El usuario pidió estimar los costos desconocidos. Se calculó con transporte informativo ARS 31.000,01, reserva propuesta de embalaje/otros ARS 3.000, cargos supuestos 15%, reserva de costo 10%, margen 10% y ganancia mínima ARS 1.000. Los supuestos no son costos reales ni cotas garantizadas. No se extrapola a otros modelos, cantidades o destinos.

Esta referencia permanece en `reference`: `amount` de la tarifa sigue en null, el total a pagar no se calcula y Mercado Pago permanece bloqueado. Se confirma el importe final por WhatsApp. Nunca convertir esa referencia en una tarifa verificada sin medir y cotizar el paquete embalado.
