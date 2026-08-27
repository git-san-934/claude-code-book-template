"""指標計算・シグナル判定・バックテストの単体テスト(合成データ使用)。

このリポジトリのCI/開発環境ではYahoo Financeへのネットワークアクセスが
ブロックされている場合があるため、実データ取得(src.data)はテスト対象外とし、
ロジック部分のみを合成データで検証する。
"""

import numpy as np

from src.backtest import run_backtest
from src.indicators import add_all_indicators, bollinger_bands, ema, macd, rsi, sma
from src.signals import generate_signals
from tests.synthetic_data import make_synthetic_ohlcv


def test_sma_and_ema_basic():
    df = make_synthetic_ohlcv()
    close = df["Close"]

    sma5 = sma(close, 5)
    assert sma5.isna().sum() == 4  # 最初の window-1 件はNaN
    assert np.isclose(sma5.iloc[10], close.iloc[6:11].mean())

    ema5 = ema(close, 5)
    assert ema5.notna().all()  # ewmはNaNを生まない


def test_rsi_range():
    df = make_synthetic_ohlcv()
    values = rsi(df["Close"]).dropna()
    assert ((values >= 0) & (values <= 100)).all()


def test_macd_columns():
    df = make_synthetic_ohlcv()
    result = macd(df["Close"])
    assert list(result.columns) == ["macd", "signal", "histogram"]
    assert np.allclose(
        result["histogram"].dropna(), (result["macd"] - result["signal"]).dropna()
    )


def test_bollinger_bands_ordering():
    df = make_synthetic_ohlcv()
    bands = bollinger_bands(df["Close"]).dropna()
    assert (bands["upper"] >= bands["middle"]).all()
    assert (bands["middle"] >= bands["lower"]).all()


def test_add_all_indicators_has_expected_columns():
    df = make_synthetic_ohlcv()
    out = add_all_indicators(df)
    expected = {
        "sma_short", "sma_long", "rsi", "macd", "macd_signal", "macd_hist",
        "bb_upper", "bb_middle", "bb_lower",
    }
    assert expected.issubset(out.columns)


def test_generate_signals_values_are_valid():
    df = make_synthetic_ohlcv()
    signal_df = generate_signals(df)
    assert set(signal_df["signal"].unique()).issubset({"買い", "売り", "様子見"})
    # スコアが4指標の合計として妥当な範囲に収まっているか
    assert signal_df["score"].between(-5, 5).all()


def test_generate_signals_produces_at_least_one_trade_signal():
    df = make_synthetic_ohlcv(n=250)
    signal_df = generate_signals(df)
    counts = signal_df["signal"].value_counts()
    assert counts.get("買い", 0) > 0
    assert counts.get("売り", 0) > 0


def test_backtest_runs_and_returns_sane_result():
    df = make_synthetic_ohlcv(n=250)
    signal_df = generate_signals(df)
    result = run_backtest(signal_df, initial_cash=1_000_000)

    assert len(result.equity_curve) == len(signal_df)
    assert result.final_equity > 0
    summary = result.summary()
    assert "トータルリターン(%)" in summary
    assert "最大ドローダウン(%)" in summary
    assert result.max_drawdown_pct <= 0


def test_backtest_no_trades_when_all_hold(monkeypatch):
    df = make_synthetic_ohlcv(n=50)
    signal_df = generate_signals(df)
    signal_df["signal"] = "様子見"
    result = run_backtest(signal_df, initial_cash=1_000_000)
    assert result.trades == []
    assert result.final_equity == 1_000_000
