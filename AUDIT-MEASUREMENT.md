# Auditoría y medición — Ferrato

## Estado encontrado

Repositorio compartido por Matías: matiasquercia/ferrato. La marca, el dominio y los datos comerciales del código son Ferrato; confirmar relación con Filicio/Malolque antes de publicar cambios de identidad.

Astro 7, React 19 por islas, Tailwind 4, nanostores, Mercado Pago y adaptador Netlify. Home y catálogo prerenderizados; checkout/webhook en servidor. Había canonical, sitemap, robots y Product/Breadcrumb JSON-LD. El README indicaba Vercel y precios vacíos aunque el código usa Netlify y contiene precios. No se modificaron precios, stock, descuentos ni umbral de envío.

Problemas: hero con propuesta poco específica; fotos locales de 1600 px enviadas incluso a miniaturas; fuentes externas bloqueantes; instalación básica de GA y Meta sin consentimiento ni eventos comerciales; formulario sin nombres accesibles; ausencia de página de privacidad. El webhook consulta el pago pero no guarda pedidos ni un registro duradero de conversiones.

## Diseño y rendimiento

Hero industrial/editorial, fotografía real Safari existente, CTA de categoría, asesoramiento visible, condiciones existentes y navegación al catálogo. Home coherente con asesoramiento y pasos de compra. Sin testimonios, certificaciones ni garantías inventadas.

WebP en 320/640/960 px; hero con srcset/sizes y prioridad alta; categorías diferidas; fuentes del sistema; foco visible y movimiento reducido. Regenerar assets con `python scripts/optimize-images.py` (Pillow). Las fotos originales se conservan. Validar derechos de uso de las fotos Safari con el proveedor como ya indicaba el README.

## Eventos y triggers (gtag directo; sin GTM adicional)

| Evento | Cuándo | Destino |
|---|---|---|
| page_view | Una vez por documento tras aceptar estadísticas | GA4 |
| view_item | Ficha de producto visible tras aceptar estadísticas | GA4, items/ARS |
| select_item | Clic en producto con metadatos desde tarjeta/hero | GA4 |
| add_to_cart | Aumento efectivo de cantidad, limitado por stock | GA4, items/value/ARS |
| whatsapp_click | Clic en enlace wa.me/api.whatsapp.com, handler delegado único | GA4; Ads opcional |
| begin_checkout | Envío válido del formulario hacia Mercado Pago | GA4, items/value/ARS |
| checkout_submit | API devuelve una preferencia y URL de pago válida | GA4; Ads opcional |
| checkout_error | Fallo al crear preferencia; sin mensaje ni datos personales | GA4 |

WhatsApp es un clic de intención, no confirma mensaje enviado ni lead recibido. checkout_submit confirma creación de preferencia, no compra. No existe formulario de contacto que guarde un lead: no se inventa generate_lead. purchase NO se dispara desde /checkout/exito, que puede abrirse manualmente y no verifica el pago.

Un único listener delegado evita duplicar eventos en enlaces React/HTML. El formulario bloquea envíos concurrentes. No se envían nombre, teléfono, email, dirección, notas ni URL de WhatsApp. Se eliminan consultas arbitrarias de page_location y rutas de referrer; se conservan solo identificadores publicitarios válidos. No poner información personal en URLs o nombres de producto.

## Consentimiento

Modo básico: sin requests a Google o Meta antes del consentimiento correspondiente. Cuatro estados de Consent Mode v2 denegados por defecto; luego update antes de config. Opciones todas, solo estadísticas o necesarias. Preferencia local durante 180 días; cambio desde pie de página y privacidad. Revocación elimina cookies conocidas y recarga para retirar listeners ya cargados. El carrito sigue funcionando. Meta existente también queda condicionado al consentimiento publicitario.

La página de privacidad describe el comportamiento técnico actual. Antes de publicar completar/confirmar razón social responsable, contacto válido, política real de conservación, tratamiento de proveedores y políticas comerciales de devolución/garantía según el negocio. No se inventaron condiciones comerciales ni certificación de cumplimiento legal.

## Conexión manual y prevención de duplicados

1. Confirmar PUBLIC_SITE_URL y marca final. Completar PUBLIC_GA_ID (G-...), PUBLIC_GOOGLE_ADS_ID (AW-...) y, si se usan conversiones directas, PUBLIC_ADS_WHATSAPP_LABEL y PUBLIC_ADS_CHECKOUT_LABEL en Netlify. Reconstruir el sitio: variables públicas se incorporan al build. Nunca poner secretos de API en PUBLIC_*.
2. Vincular GA4 con Google Ads y activar etiquetado automático. Configurar referencias no deseadas de Mercado Pago en GA4. Para campañas con UTM manual usar campos de campaña explícitos tras una revisión de datos: no se reenvían consultas libres del navegador.
3. En GA4 desactivar medición mejorada automática de formularios y clics salientes para no confundirlos con eventos propios. No configurar otra etiqueta de page_view, historial SPA o GTM sobre esta instalación multipágina.
4. Elegir UNA fuente por conversión: conversión directa de Ads con label, O importar evento clave de GA4. No marcar ambas como primarias. Empezar clics de WhatsApp y preferencias como conversiones secundarias; no optimizar campañas a una compra inexistente.
5. purchase necesita pedido persistente, pago approved consultado al proveedor, transaction_id estable, total y moneda del servidor, consentimiento asociado y deduplicación duradera por transacción. Guardar client_id/session_id con permiso y enviar Measurement Protocol desde servidor usando un secreto privado. La integración actual no dispone de esa persistencia: es trabajo pendiente, no se sustituye por un evento al visitar éxito.
6. Probar con Tag Assistant y DebugView: aceptación, rechazo, revocación, recarga, WhatsApp, productos, carrito y pago de prueba. No habilitar pagos reales para pruebas. Verificar cada conversión en Google Ads y la recepción en GA4; requiere acceso de cuenta no disponible en esta sesión.
7. Usar páginas de categoría/producto relevantes para cada anuncio y mantener concordancia con disponibilidad y precios reales. Medir CWV de campo en Search Console/CrUX tras despliegue; un build o una prueba local no certifican CWV reales.

Fuentes oficiales:
- https://developers.google.com/tag-platform/security/guides/consent
- https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- https://support.google.com/analytics/answer/12200568


## Verificación realizada

- `astro check`: 0 errores, 0 advertencias; build completo con adaptador Netlify correcto usando las dependencias del package-lock (npm ci).
- `node --test tests/analytics.test.mjs`: 7 pruebas aprobadas: denegación, consentimiento parcial, doble inicialización, separación GA/Ads, expiración, almacenamiento bloqueado y revocación.
- Navegador sobre build de producción: home, agregar producto, apertura de carrito, total y formulario; preferencias se abren y se cierran al rechazar. Anchos 390 y 320 px sin desborde horizontal en la home; checkout de 390 px sin desborde. Sin imágenes rotas en home. Sin nuevos errores de consola en estas rutas de producción.
- El dev server inicialmente mostró errores de emulación Netlify y módulos Vite después de reinstalar dependencias; se deshabilitó devFeatures (solo desarrollo) y la validación funcional se hizo sobre el build compilado. No es una prueba de pago extremo a extremo.
- Auditoría npm: 8 avisos altos heredados de la cadena de desarrollo Netlify (extract-zip e ipx/sharp y dependientes). La reparación automática propone bajar el adaptador de versión mayor; no se aplicó por riesgo de incompatibilidad. Revisar actualización compatible del proveedor antes de dar por cerrada la auditoría de dependencias.
- No se accedió a reportes reales de Analytics ni a la configuración privada de Ads. No se verificó entrega de eventos en cuentas ni Core Web Vitals de campo.
