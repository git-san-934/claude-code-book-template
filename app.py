"""株価売買タイミング判定ダッシュボード (Streamlit)。

実行方法:
    streamlit run app.py

デフォルト銘柄はキオクシアホールディングス (285A.T)。
サイドバーで銘柄コード・取得期間を変更できる。
"""

import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from src.backtest import run_backtest
from src.data import DEFAULT_TICKER, fetch_price_history
from src.signals import generate_signals, latest_signal

st.set_page_config(page_title="株価売買タイミング判定", layout="wide")

st.sidebar.header("設定")
ticker = st.sidebar.text_input("銘柄コード (yfinance形式)", value=DEFAULT_TICKER)
period = st.sidebar.selectbox("取得期間", ["3mo", "6mo", "1y", "2y"], index=2)
initial_cash = st.sidebar.number_input("バックテスト初期資金(円)", value=1_000_000, step=100_000)

st.title("株価売買タイミング判定")
st.caption(
    "移動平均クロス・RSI・MACD・ボリンジャーバンドの4指標を合議させたスコアリングで"
    "「買い / 売り / 様子見」を判定します。投資助言ではありません。"
)

try:
    price_df = fetch_price_history(ticker, period=period)
    signal_df = generate_signals(price_df)
except ValueError as e:
    st.error(str(e))
    st.stop()

tab_dashboard, tab_backtest = st.tabs(["ダッシュボード", "バックテスト"])

with tab_dashboard:
    latest = latest_signal(signal_df)

    col1, col2, col3 = st.columns(3)
    col1.metric("最新シグナル", latest["signal"])
    col2.metric("終値", f"{latest['close']:.1f} 円")
    col3.metric("スコア", f"{latest['score']:.0f}")

    with st.expander("スコア内訳"):
        for name, value in latest["breakdown"].items():
            st.write(f"- {name}: {value:+.0f}")

    fig = make_subplots(
        rows=3,
        cols=1,
        shared_xaxes=True,
        row_heights=[0.55, 0.2, 0.25],
        vertical_spacing=0.03,
        subplot_titles=("価格・移動平均・ボリンジャーバンド", "RSI", "MACD"),
    )

    fig.add_trace(
        go.Candlestick(
            x=signal_df.index,
            open=signal_df["Open"],
            high=signal_df["High"],
            low=signal_df["Low"],
            close=signal_df["Close"],
            name="価格",
        ),
        row=1,
        col=1,
    )
    fig.add_trace(go.Scatter(x=signal_df.index, y=signal_df["sma_short"], name="SMA5"), row=1, col=1)
    fig.add_trace(go.Scatter(x=signal_df.index, y=signal_df["sma_long"], name="SMA25"), row=1, col=1)
    fig.add_trace(
        go.Scatter(x=signal_df.index, y=signal_df["bb_upper"], name="BB上限", line=dict(dash="dot")),
        row=1,
        col=1,
    )
    fig.add_trace(
        go.Scatter(x=signal_df.index, y=signal_df["bb_lower"], name="BB下限", line=dict(dash="dot")),
        row=1,
        col=1,
    )

    buys = signal_df[signal_df["signal"] == "買い"]
    sells = signal_df[signal_df["signal"] == "売り"]
    fig.add_trace(
        go.Scatter(
            x=buys.index, y=buys["Close"], mode="markers", name="買いシグナル",
            marker=dict(symbol="triangle-up", size=12, color="red"),
        ),
        row=1, col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=sells.index, y=sells["Close"], mode="markers", name="売りシグナル",
            marker=dict(symbol="triangle-down", size=12, color="blue"),
        ),
        row=1, col=1,
    )

    fig.add_trace(go.Scatter(x=signal_df.index, y=signal_df["rsi"], name="RSI"), row=2, col=1)
    fig.add_hline(y=70, line_dash="dot", row=2, col=1)
    fig.add_hline(y=30, line_dash="dot", row=2, col=1)

    fig.add_trace(go.Scatter(x=signal_df.index, y=signal_df["macd"], name="MACD"), row=3, col=1)
    fig.add_trace(go.Scatter(x=signal_df.index, y=signal_df["macd_signal"], name="Signal"), row=3, col=1)
    fig.add_trace(go.Bar(x=signal_df.index, y=signal_df["macd_hist"], name="Histogram"), row=3, col=1)

    fig.update_layout(height=900, xaxis_rangeslider_visible=False, legend=dict(orientation="h"))
    st.plotly_chart(fig, use_container_width=True)

with tab_backtest:
    result = run_backtest(signal_df, initial_cash=initial_cash)
    summary = result.summary()

    cols = st.columns(len(summary))
    for col, (label, value) in zip(cols, summary.items()):
        col.metric(label, value)

    equity_fig = go.Figure()
    equity_fig.add_trace(go.Scatter(x=result.equity_curve.index, y=result.equity_curve, name="評価額"))
    equity_fig.update_layout(title="資産評価額の推移", height=400)
    st.plotly_chart(equity_fig, use_container_width=True)

    if result.trades:
        st.subheader("取引履歴")
        st.dataframe(
            [
                {
                    "エントリー日": t.entry_date.date(),
                    "エントリー価格": round(t.entry_price, 1),
                    "エグジット日": t.exit_date.date(),
                    "エグジット価格": round(t.exit_price, 1),
                    "リターン(%)": round(t.return_pct, 2),
                }
                for t in result.trades
            ]
        )
    else:
        st.info("この期間では取引が発生しませんでした。")
