// ponte com o app desktop (Tauri); no navegador tudo segue igual
const T = globalThis.__TAURI__;
export const isDesktop = !!T;
export const call = (cmd, args) => isDesktop ? T.core.invoke(cmd, args) : Promise.reject(new Error('somente no desktop'));
export const info = isDesktop ? call('info').catch(() => null) : Promise.resolve(null);
