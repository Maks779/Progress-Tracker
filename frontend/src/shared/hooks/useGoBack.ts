import { type Href, useRouter } from 'expo-router';

/**
 * Goes back one screen, or to `fallback` when there is nothing to go back to (a page opened
 * straight from a link on the web, or after a reload).
 */
export function useGoBack(fallback: Href) {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  };
}
