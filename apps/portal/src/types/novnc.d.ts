// @novnc/novnc ships no types, and the published @types/novnc__novnc targets
// an older file layout (lib/rfb) than the installed package's actual
// "exports": "./core/rfb.js" — hence this local declaration, scoped to the
// RFB surface this app actually uses.
declare module '@novnc/novnc' {
  export interface RFBCredentials {
    username?: string
    password?: string
    target?: string
  }

  export interface RFBOptions {
    shared?: boolean
    credentials?: RFBCredentials
    repeaterID?: string
    wsProtocols?: string[]
  }

  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string, options?: RFBOptions)
    scaleViewport: boolean
    resizeSession: boolean
    disconnect(): void
  }
}
