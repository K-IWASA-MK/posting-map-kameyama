# LINE Platform Research (Research 001)

## 【事実】

・LINE Headerは、LINEアプリがLIFF WebViewの上部に配置するネイティブナビゲーションバーである。
・LINE Headerには「閉じるボタン（×）」「オプションメニュー（︙）」およびタイトル/ドメインが表示される。
・LIFF WebViewの描画領域（Drawable Area）は、LINE Headerの下端から開始される。
・iOSのSafe Area Top（ステータスバー、Dynamic Island、ノッチ領域）はLINEアプリのネイティブHeader配下に位置し、WebViewの描画領域の上限はHeader下端となる。
・iOSのSafe Area Bottom（Home Indicator領域）はWebViewの最下部に位置し、CSS `env(safe-area-inset-bottom)` によって値を取得可能である。
・`window.innerWidth` はデバイスのビューポート幅（100vw）と一致する。
・`visualViewport` API（`visualViewport.width`, `visualViewport.height`）はモダンiOS/AndroidのWebView環境で参照可能であり、ソフトウェアキーボード表示時に `visualViewport.height` が変化する。
・LINEアプリ側のダークモード設定（OS連動含む）は、CSSの `@media (prefers-color-scheme: dark)` で検知可能である。


## 【未確認】

・iPhoneの端末種別（Dynamic Island搭載機、ノッチ機、ホームボタン機）ごとの LINE Header の正確なピクセル高さ（px/pt）。
・実機環境における `window.innerHeight` および `visualViewport.height` の初期確定値（HeaderおよびHome Indicator差し引き後の有効高さ）。
・WebViewスクロール時における LINE Header の挙動（完全固定か、スクロール追従・畳み込み・透過変化が発生するか）。
・CSS `position: fixed` や `position: sticky` を指定した要素が、WebViewのスクロール時に LINE Header の下端境界に潜り込む（侵入・クリッピングされる）かどうかの視覚的挙動。
・ソフトウェアキーボード展開時における LINE Header の位置固定状態と、`window.innerHeight` / `visualViewport.height` の変動数値および差分。
・LIFF表示サイズ（Full / Tall / Compact）ごとの LINE Header 構造および可視領域の変化。
・LINE Header内の×ボタンおよびメニューボタンの実際のタップ可能領域とWebView要素との干渉の有無。


## 【追加調査】

・実機（iOS / Android）での測定スクリプト実行による `window.innerWidth`, `window.innerHeight`, `visualViewport.width`, `visualViewport.height`, `env(safe-area-inset-*)` の絶対値ログの取得。
・WebViewスクロールテストページを用いた、`position: fixed` / `sticky` 要素と LINE Header 境界線での重なり・潜り込み挙動の画面確認およびデータ取得。
・iOS (WebKit / Safari WebView) と Android (Android WebView / Chrome) における LINE Header 周りの挙動差分比較。
・キーボード表示・非表示切り替え時における `visualViewport` リサイズイベントの発火タイミングと高さを測定。
