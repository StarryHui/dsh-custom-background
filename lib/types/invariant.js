/**
 * Package-owned invariant companion for `@starryhui/dsh-background`.
 * @module @starryhui/dsh-background/invariant
 */
const PACKAGE_NAME = '@starryhui/dsh-background';
/** Cordis companion plugin name. */
export const name = 'dsh-background-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/** No runtime invariant: the plugin owns no event stream or mutable runtime data. */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map