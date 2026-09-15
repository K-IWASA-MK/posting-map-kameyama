# LINE UI Reverse Engineering (Research 001)

LINEアプリ上のLIFF表示におけるUI構造および境界挙動の解析記録。

---

## 【事実】

### 1. Header高さ (Header Height)
・LINE Headerは、OSのステータスバー領域（iPhoneノッチ/Dynamic Islandを含む）とLINEアプリ独自のネイティブ操作ナビゲーションバー（タイトル、×ボタン、オプションボタン）の合算領域として最上部に配置される。
・LINE Native Header自体の標準高さ（ステータスバー除く）はiOS上で通常 **44pt (px)**、Android上で **56dp (px)** である。
・ステータスバー領域を含めたトータル非描画境界高さは、iPhoneノッチ/Dynamic Island搭載機で約 **88px〜94px** (スケールFactor @2/@3に依存) となる。

### 2. Header背景 (Header Background)
・LINE Headerの背景は、デフォルト設定においてネイティブアプリ側の単色ヘッダー背景色（ライトモード: 白 `#FFFFFF` / ダークモード: ダークグレー `#111111` 前後）で塗りつぶされる。
・LIFF WebView内のCSS背景が透過（`background: transparent`）であっても、LINE Native Headerの背景が自動で透過してコンテンツが透けることはない。

### 3. Header Shadow (Header Shadow / Elevation)
・LINE Header下端には、iOS/Android標準のネイティブElevation / Shadow（微小なドロップシャドウ）または下部境界境界線が付与される。
・これにより、WebViewのスクロールコンテンツとHeaderの視覚的境界線が物理的に区分される。

### 4. 境界線 (Border / Separator)
・Header最下部には、通常1px幅の境界ライン（`#E5E5E5` 相当、ダークモード時は `#222222` 相当）または影が描画され、WebViewコンテンツ領域のY=0はこの境界線の直下から開始する。

### 5. Drawable Area開始位置 (Drawable Area Top Y)
・LIFF WebViewのHTML `<body>` が描画を開始できる最上部（CSS Y=0）は、LINE Header最下部の直下（Header領域の外側）である。
・WebView側からCSS `top: 0` または `margin-top: 0` を指定しても、描画がLINE Headerの背後に潜り込んでステータスバー位置まで到達することはない（Full Size LIFFでHeaderが完全にアプリ側で隠蔽されない限り）。

### 6. スクロール時の挙動 (Scroll & Layer Hierarchy)
・WebView内を上下にスクロールした際、WebViewのBodyコンテンツ（Text, Card, Imageなど）は LINE Header の直下境界線を通って **Headerの背後に潜り込む（Headerに隠される）** 構造となる。
・LINE HeaderはZインデックス最前面のネイティブレイヤーとして固定（Sticky / Fixed）されており、WebViewのスクロール操作によってHeader自体の高さが伸縮したり消滅したりすることはない。

### 7. Bottom Navigation & Safe Area
・画面最下部にはiOSの Home Indicator 領域（高さ約34px）が存在する。
・LIFF WebViewの最下部は Home Indicator の上端まで、または Home Indicator を覆う領域まで展開され、CSS `env(safe-area-inset-bottom)` または `padding-bottom` による下部セーフエリア保護が必要となる。


---

## 【未確認】

・iOS/Android端末の実機スクリーンショットをピクセル単位で切り出して測定した、各種画面解像度（iPhone 13/14/15/16 Pro, SE3, Galaxy, Pixel等）における LINE Header のピクセル幅・高さ絶対値。
・`position: fixed` または `position: sticky` を指定したCSS要素が、WebViewの最上部（Y=0）に配置された際に、スクロール時にLINE Headerの影（Shadow/Border）と重なる際のピクセル精度の重なり順序（Z-Order）。
・LINEアプリ内でのフォントサイズ設定やOSのアクセシビリティ（テキスト拡大）設定変更時に、LINE Headerの高さが動的に変化するかどうか。
・ソフトウェアキーボード表示時に、画面下部のSafe Area Bottom値およびビューポート高さ（`visualViewport.height`）がどのタイミングで再計算・更新されるかの実測フレーム推移。


---

## 【追加調査】

・実機端末（iOSおよびAndroid）でLINEアプリ上のLIFFを実際に起動し、画面全体の高解像度スクリーンショットを取得して、デザインツール（Figma等）上でピクセル実測を行う。
・各端末解像度での Header高さ（px）、ステータスバー高さ（px）、有効Drawable領域高さ（px）、Home Indicator高さ（px）の全測定マトリックス表の作成。
・実機スクリーンショット上でのカラーピッカー検証による、Header境界線（Border）の正確なHEXカラーコードおよび1px/2pxの線幅検証。
・スクロール追従要素（`sticky` ヘッダー等）を配置した検証用HTMLをLIFF上で動かし、LINE Header境界線との接触・潜り込み時の挙動をキャプチャ動画で観察・分析。
