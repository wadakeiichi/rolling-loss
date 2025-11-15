
# Crr Simulator — 理論背景とパラメータ説明

最終更新: 2025-11-15 08:17

この Web アプリは **自転車タイヤの転がり抵抗**を、ヒステリシス損失とインパクト（サスペンション）損失に分けて、**圧力依存性**として可視化するための**現象論モデル**です。右側のグラフには
$C_{\mathrm{rr}}(p)$ またはそれに荷重・速度を掛けた **Rolling loss [W]** を表示します。

---

## 1. モデル式（最小合成モデル）

$$
C_{\mathrm{rr}}(p) \;=\; \underbrace{\frac{A}{p} + B}{\text{ヒステリシス + 高圧フロア}}\; +\; \underbrace{D\,\Big(\frac{p}{p_0}\Big)^{\gamma}}{\text{インパクト（路面励起）}}
$$

- **ヒステリシス項** $A/p$: 接地長 $\ell\propto N/(p\,w)$ と繰返し変形（曲げ・せん断）に起因。圧を上げると接地が「短く太く」なり散逸が減る。  
- **高圧側フロア** $B$: 圧を上げても残る材料内損失やベアリング等を表す底上げ項。  
- **インパクト項** $D(p/p_0)^{\gamma}$: 粗い舗装で圧を上げると空気ばねが硬化し上下入力の透過率が上がる → 人体・ホイール・タイヤ内部の減衰で熱になる損失を単調増関数で表現。

> 速度 $v$ と荷重 $N=mg$ を掛けると **必要パワー**: $P(p)=C_{\mathrm{rr}}(p)\,N\,v$ が得られます。

---

## 2. パラメータの意味と推奨レンジ

- **A**（ヒステリシス係数）: 単位は「barを使うモデル」では *bar*。幅 $w$、車輪半径 $R$、荷重 $N$ によって一次近似で  
  $$
  A \;\approx\; \kappa\,\frac{N}{w\,R}\;\Big/\,10^{5} \quad(\text{Pa→bar 換算})
  $$  
  ここで $\kappa$ はゴムの損失正接やカーカス構造を束ねた **無次元係数**（およそ 0.01–0.05）。  
  太いタイヤ（大きい $w$）・大径ホイール（大きい $R$）・軽い荷重（小さい $N$）ほど **A は小さく**なります。

- **B**（高圧フロア）: 高圧化しても残る底上げ。舗装路の良いタイヤで $\sim 0.0015\!\sim\!0.004$。

- **D**（インパクト規模）: 基準圧 $p_0$ におけるインパクト由来の **係数スケール**。実測の余剰パワー $P_{\mathrm{imp}}(p_0)$ から  
  $$
  D \;=\; \frac{P_{\mathrm{imp}}(p_0)}{N\,v}
  $$  
  で見積ります（例: 30 km/h, 65 kg で 1 W 余計なら $D\approx 1.9\times10^{-4}$）。  
  スムース舗装: $10^{-4}\!\sim\!3\times10^{-4}$、粗いチップシール: $5\times10^{-4}\!\sim\!10^{-3}$ 程度が目安。

- **$p_0$**: インパクト項の基準圧。通常は 6 bar など任意の代表値。

- **$\gamma$**（圧べき指数）: **1** を第一近似に、粗さ・速度が大きいほど **1.2–2** へ。  
  根拠: タイヤ縦ばね $k\propto p$、基礎励振の透過・減衰が加速度二乗に効く帯域では損失が $\propto p^{\gamma}$（$1\!\le\!\gamma\!\le\!2$）。

- **速度・質量**: グラフ注記と **Power = Crr·N·v** の換算に使用。モデル式の形には直接入れていません（必要なら拡張可）。

- **タイヤ太さ $w$, 有効半径 $R$**: A の自動算出で使用。700C の **ビード座直径 622 mm** を基準に $R\approx 0.311 + w/2000$ [m] と近似。

---

## 3. A の自動算出（アプリの「自動算出」チェック）

アプリ内の自動モードでは  
$$
A \approx \kappa\,\frac{N}{w\,R}\Big/10^{5}
$$  
を用いて **質量（=荷重）**と**タイヤ太さ**から $A$ を求めます。$\kappa$ はユーザ入力。  
この式は「接地面積 $\sim N/p$」「接地長 $\sim N/(p w)$」「合力の前方ずれ $\propto $ 接地半長」に基づくスケーリングです。

---

## 4. D の見積もり（実走キャリブレーション）

同速度・同姿勢で **滑らか舗装 vs 粗い舗装** の必要パワー差 $\Delta P$ を取り、$D=\Delta P/(N v)$ とします。  
パワーメータのラップ比較/往復 TT、または長い緩斜面でのコーストダウン（減速率差）から推定できます。

---

## 5. 推奨の使い方

1. まず **舗装路**で $\gamma=1$, 代表値の $D$ から開始。  
2. 実走の余剰パワー感（粗さ・速度）に合わせて **D** を調整、必要に応じて **$\gamma$** を 1.2–1.8 に。  
3. 幅を変える場合は **A の自動算出**を ON にして比較（下段の ±2 mm 比較チャートが参考）。  
4. **最適圧**は合計曲線の極小で確認。粗い舗装ほど最適圧は低めに寄ります。

---

## 6. 限界と注意

- **現象論モデル**：温度上昇（自己発熱）による $\tan\delta(\omega,T)$ の変化や空力、横方向の滑りは簡略化。  
- パラメータは **タイヤ銘柄・温度・チューブ種**で変わります。実走キャリブレーションを推奨。  
- 粗い路面では路面スペクトルが広帯域のため、$\gamma$ と $D$ の感度が上がります。

---

## 7. 実行方法（開発サーバ）

```bash
npm install
npm start
```
ブラウザで http://localhost:3000 を開きます。

---

## 8. 参考：主要ファイル
- `src/CrrSimulator.jsx` — コンポーネント本体（UI・計算・描画）
- `README.md` — 本ドキュメント（このセクション）


---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
