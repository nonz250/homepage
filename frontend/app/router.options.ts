import type { RouterConfig } from '@nuxt/schema'

/**
 * Nuxt の router オプション。
 *
 * vue-scrollto から vue-router の scrollBehavior へ移行するための設定。
 * hash リンク (/#about など) 到達時のスクロール先オフセットは
 * CSS の scroll-margin-top: var(--header-height) 側で担保しているため、
 * ここでは top オフセット指定を行わない。
 */
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }

    return { top: 0 }
  },
}
