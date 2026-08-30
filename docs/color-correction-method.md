# BridgePalette 色補正エンジン

BridgePalette の色補正は、色相を固定ルールで置換する方式ではなく、画像ごとに色の衝突を測定してから補正する。

## 処理手順

1. 画像を約12,000画素まで格子サンプリングし、CIELAB空間で最大10色の代表色へクラスタリングする。
2. P・D・T型の見え方を、Machado・Oliveira・Fernandes（2009）の行列で推定する。行列はガンマ補正済みのsRGB値へ直接適用せず、線形sRGBへ変換してから適用する。
3. C型では十分に異なるのに、対象タイプの推定では近づく代表色の組を「混同ペア」として検出する。
4. CUD推奨配色セット ver.4 の画面用sRGB色を補正候補とする。
5. 各候補を対象タイプで再シミュレーションし、混同ペアのCIEDE2000色差が大きくなる組合せを選ぶ。同時に元画像からの色差を罰則として扱い、不要な色変更を抑える。
6. 補正前のCIELAB L*を維持し、主にa*・b*を動かす。sRGB色域外へ出る場合は彩度を段階的に下げて色域内へ収める。
7. 補正後にもう一度シミュレーションし、混同ペア数、平均CIEDE2000色差、平均輝度ずれを画面に表示する。

混同ペアの判定閾値と目標色差は、既存規格の合否値ではなく、過剰な色変更を避けながら区別を広げるための実装上のパラメータである。画面の数値も、画像の代表色に対するモデル推定値として表示する。

## 採用データ・根拠

- Machado, Oliveira, Fernandes, “A Physiologically-based Model for Simulation of Color Vision Deficiency,” IEEE TVCG, 2009. <https://doi.org/10.1109/TVCG.2009.113>
- カラーユニバーサルデザイン推奨配色セット ver.4（画面用sRGB）。<https://jfly.uni-koeln.de/colorset/>
- Ebelin et al., “Luminance-Preserving and Temporally Stable Daltonization,” Eurographics 2023. <https://research.nvidia.com/labs/rtr/publication/ebelin2023luminance/>
- W3C, Web Content Accessibility Guidelines 2.2, Use of Color / Contrast. <https://www.w3.org/TR/WCAG22/>

## 限界

- 自動補正は医学的診断や、個人の主観的な見え方の再現ではない。
- CIEDE2000とシミュレーションは、画面上の色の区別しやすさを推定するための指標である。
- 写真、印刷、プロジェクター、細い線、小さな色面では結果が変わる。
- 重要な用途では、模様・文字・輪郭など色以外の手掛かりと、当事者によるタスク評価を併用する。
