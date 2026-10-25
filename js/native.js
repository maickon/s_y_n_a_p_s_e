// ponte com o app desktop (Tauri); no navegador tudo segue igual
const T = globalThis.__TAURI__;
export const isDesktop = !!T;
export const call = (cmd, args, opt) => isDesktop ? T.core.invoke(cmd, args, opt) : Promise.reject(new Error('somente no desktop'));
export const info = isDesktop ? call('info').catch(() => null) : Promise.resolve(null);
// progresso de downloads nativos ({url, loaded, total}) para o callback atual
let onDl;
export const onDownload = f => { onDl = f; };
if (isDesktop) T.event.listen('native-dl', e => onDl?.(e.payload));
