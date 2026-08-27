# stock-timing-judge

株価の売買タイミング(買い時・売り時)を判定するダッシュボード。

デフォルト対象銘柄はキオクシアホールディングス(東証コード: 285A)。
移動平均クロス・RSI・MACD・ボリンジャーバンドの4指標を重み付けスコアリングして
合議させ、「買い / 売り / 様子見」を判定する。単一指標のダマシを減らすのが狙い。

## セットアップ

```bash
pip install -r requirements.txt
```

## 実行

```bash
streamlit run app.py
```

サイドバーから銘柄コード(yfinance形式、東証は `XXXX.T`)や取得期間、
バックテストの初期資金を変更できる。

## 構成

- `src/data.py` — yfinanceでの株価取得
- `src/indicators.py` — SMA/EMA/RSI/MACD/ボリンジャーバンドの計算
- `src/signals.py` — 複数指標のスコアリングによる売買シグナル判定
- `src/backtest.py` — シグナルロジックの簡易バックテスト(手数料・スリッページなし)
- `app.py` — Streamlitダッシュボード(チャート表示・バックテスト結果表示)
- `tests/` — 合成データ(`tests/synthetic_data.py`)によるロジック検証

## テスト

```bash
pytest tests/
```

ネットワーク制限のある環境でも実行できるよう、テストは実際のYahoo Finance
アクセスに依存せず合成データ(ランダム生成した疑似株価)でロジックのみ検証する。

## 注意

- 投資助言ではありません。シグナルは過去データに基づく機械的な判定であり、
  将来の値動きを保証するものではありません。
- yfinanceは非公式スクレイピングベースのため、レート制限やデータ欠損が
  発生することがあります。本格運用する場合は[J-Quants API](https://jpx-jquants.com/)
  などの公式APIへの切り替えを推奨します。
