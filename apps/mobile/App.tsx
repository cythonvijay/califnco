import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';

const DEFAULT_SITE_URL = 'https://califnco-orcin.vercel.app';
const configuredSiteUrl = (process.env.EXPO_PUBLIC_SITE_URL ?? '').trim();
function normalizeSiteUrl(value: string): string {
  const candidate = (value || DEFAULT_SITE_URL).replace(/\/+$/, '');

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_SITE_URL;
    }

    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

const SITE_URL = normalizeSiteUrl(configuredSiteUrl || DEFAULT_SITE_URL);

const BRAND = '#142B45';
const ICE = '#72C9E8';
const BG = '#F4F8FB';

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPaymentUrl(url: string): boolean {
  return /razorpay|rzp\.io|checkout\.razorpay/i.test(url);
}

/**
 * Keep website navigation changes visible to the Android hardware-back handler.
 * Product data, authentication, checkout, and permissions remain controlled
 * by the actual CALIFNCO website and its backend.
 */
const HISTORY_BRIDGE = `
(function () {
  if (window.__califncoNativeHistoryBridge) return true;
  window.__califncoNativeHistoryBridge = true;

  var send = function () {
    try {
      window.ReactNativeWebView &&
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CALIFNCO_NAV',
          url: window.location.href,
          canGoBack: window.history.length > 1
        }));
    } catch (_) {}
  };

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = window.history[method];

    window.history[method] = function () {
      var result = original.apply(this, arguments);
      setTimeout(send, 0);
      return result;
    };
  });

  window.addEventListener('popstate', send);
  document.addEventListener('click', function () {
    setTimeout(send, 0);
  }, true);

  send();
  return true;
})();
true;
`;

export default function App() {
  const webViewRef = useRef<WebView<{}> | null>(null);
  const pendingPaymentReturn = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(SITE_URL);
  const [canGoBack, setCanGoBack] = useState(false);

  const openExternal = useCallback(async (url: string) => {
    try {
      if (isPaymentUrl(url)) {
        pendingPaymentReturn.current = true;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Unable to open link',
        'This link could not be opened on your device. Please check that a browser or payment app is installed.',
      );
    }
  }, []);

  const shouldStartLoad = useCallback(
    (request: { url: string }) => {
      const url = request.url;

      if (url === 'about:blank' || url.startsWith('data:')) {
        return true;
      }

      // Open phone, email, messaging, UPI, and app deep links through Android.
      if (/^(tel:|mailto:|sms:|whatsapp:|upi:|intent:)/i.test(url)) {
        void openExternal(url);
        return false;
      }

      const target = parsedUrl(url);

      if (!target) {
        return false;
      }

      // Allow regular web redirects, including canonical-host redirects,
      // authentication redirects, and website navigation.
      if (target.protocol === 'https:' || target.protocol === 'http:') {
        return true;
      }

      void openExternal(url);
      return false;
    },
    [openExternal],
  );

  const onNavigationStateChange = useCallback(
  (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);

    if (nav.url) {
      setCurrentUrl(nav.url);
    }

    // Clear the overlay when WebView reports that navigation has finished.
    if (!nav.loading) {
      setIsLoading(false);
      setLoadFailed(false);
      setLoadError(null);
    }
  },
  [],
);

  const onOpenWindow = useCallback(
    (event: { nativeEvent: { targetUrl: string } }) => {
      const url = event.nativeEvent.targetUrl;

      if (!url || url === 'about:blank' || url.startsWith('data:')) {
        return;
      }

      // Keep website pages and hosted Razorpay checkout URLs inside the WebView.
      if (/^https?:\/\//i.test(url)) {
        webViewRef.current?.injectJavaScript(
          `window.location.href = ${JSON.stringify(url)}; true;`,
        );
        return;
      }

      // Route UPI intents and other app-specific links through Android.
      void openExternal(url);
    },
    [openExternal],
  );

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        url?: string;
        canGoBack?: boolean;
      };

      if (message.type !== 'CALIFNCO_NAV') {
        return;
      }

      if (typeof message.canGoBack === 'boolean') {
        setCanGoBack(message.canGoBack);
      }
    } catch {
      // Ignore messages that aren't from the navigation bridge.
    }
  }, []);

  // Android hardware Back navigates within the website when possible.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [canGoBack]);

  // Refresh the website after returning from external payment.
  // The server-side payment callback remains authoritative.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pendingPaymentReturn.current) {
        pendingPaymentReturn.current = false;
        webViewRef.current?.reload();
      }
    });

    return () => subscription.remove();
  }, []);

  // Show an error rather than leaving an endless loading screen.
  useEffect(() => {
    if (!isLoading || loadFailed) {
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
      setLoadFailed(true);
      setLoadError(
        'The website did not finish loading within 25 seconds. Check that this URL opens in Chrome and that your network allows it.',
      );
    }, 25_000);

    return () => clearTimeout(timer);
  }, [isLoading, loadFailed]);

  const retry = useCallback(() => {
    setLoadFailed(false);
    setLoadError(null);
    setCurrentUrl(SITE_URL);
    setIsLoading(true);

    webViewRef.current?.stopLoading();

    // Load the configured start URL rather than reloading a failed redirect.
    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(SITE_URL)}; true;`,
    );
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.root}
        edges={['top', 'right', 'bottom', 'left']}
      >
        <StatusBar barStyle="light-content" />

        <WebView
          ref={webViewRef}
          source={{ uri: SITE_URL }}
          style={styles.webview}
          containerStyle={styles.webviewContainer}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows
          onOpenWindow={onOpenWindow}
          javaScriptCanOpenWindowsAutomatically
          mixedContentMode="never"
          pullToRefreshEnabled={Platform.OS === 'ios'}
          injectedJavaScriptBeforeContentLoaded={HISTORY_BRIDGE}
          injectedJavaScript={HISTORY_BRIDGE}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={shouldStartLoad}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={(event) => {
            setIsLoading(true);
            setLoadFailed(false);
            setLoadError(null);
            setCurrentUrl(event.nativeEvent.url || SITE_URL);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
          }}
          onError={(event) => {
            const description = event.nativeEvent.description?.trim();
            const failedUrl =
              event.nativeEvent.url || currentUrl || SITE_URL;

            setIsLoading(false);
            setLoadFailed(true);
            setCurrentUrl(failedUrl);
            setLoadError(
              description
                ? `${description} (${failedUrl})`
                : `Could not load ${failedUrl}`,
            );
          }}
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.loadingTitle}>Opening CALIFNCO</Text>
              <Text style={styles.loadingText}>
                Connecting to the live store…
              </Text>
            </View>
          )}
          startInLoadingState
          textZoom={100}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          bounces={Platform.OS === 'ios'}
          accessibilityLabel="CALIFNCO website"
        />

        {isLoading && !loadFailed && (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <View style={styles.brandMark}>
              <Text style={styles.brandText}>CALIFNCO</Text>
              <View style={styles.brandUnderline} />
            </View>

            <ActivityIndicator size="large" color={BRAND} />

            <Text style={styles.loadingTitle}>Opening CALIFNCO</Text>

            <Text style={styles.loadingText}>
              Connecting to the live CALIFNCO website…
            </Text>
          </View>
        )}

        {loadFailed && (
          <View style={styles.failureOverlay}>
            <View style={styles.brandMark}>
              <Text style={styles.brandText}>CALIFNCO</Text>
              <View style={styles.brandUnderline} />
            </View>

            <Text style={styles.failureTitle}>
              Can't reach the CALIFNCO website
            </Text>

            <Text style={styles.failureText}>
              {loadError ??
                'The live website could not be loaded. Check that the site opens in Chrome, then retry.'}
            </Text>

            <Text selectable style={styles.siteAddress}>
              Start URL: {SITE_URL}
              {currentUrl !== SITE_URL
                ? `\nReached: ${currentUrl}`
                : ''}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry connection</Text>
            </Pressable>

            <Pressable
              accessibilityRole="link"
              onPress={() => void openExternal(SITE_URL)}
              style={styles.browserButton}
            >
              <Text style={styles.browserText}>
                Open website in browser
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND,
  },

  webviewContainer: {
    flex: 1,
    backgroundColor: BG,
  },

  webview: {
    flex: 1,
    backgroundColor: BG,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BG,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BG,
  },

  brandMark: {
    alignItems: 'center',
    marginBottom: 18,
  },

  brandText: {
    color: BRAND,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2.2,
  },

  brandUnderline: {
    marginTop: 6,
    height: 4,
    width: 54,
    borderRadius: 2,
    backgroundColor: ICE,
  },

  loadingTitle: {
    color: BRAND,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },

  loadingText: {
    color: '#4E6378',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  failureOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: BG,
  },

  failureTitle: {
    color: BRAND,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },

  failureText: {
    color: '#4E6378',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },

  siteAddress: {
    color: '#4E6378',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },

  retryButton: {
    minWidth: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: BRAND,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  browserButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  browserText: {
    color: BRAND,
    fontWeight: '700',
    fontSize: 14,
  },
});