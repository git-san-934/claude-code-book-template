"""株価データ取得モジュール。

東証銘柄は yfinance でコードに ".T" を付けて取得する
(例: キオクシアホールディングス 285A -> "285A.T")。
"""

import pandas as pd
import yfinance as yf

DEFAULT_TICKER = "285A.T"  # キオクシアホールディングス


def fetch_price_history(ticker: str = DEFAULT_TICKER, period: str = "1y") -> pd.DataFrame:
    """指定銘柄の日足OHLCVを取得する。

    Args:
        ticker: yfinance銘柄コード (東証は "XXXX.T" 形式)。
        period: 取得期間 ("6mo", "1y", "2y" など yfinance の period 表記)。

    Returns:
        columns=[Open, High, Low, Close, Volume], DatetimeIndex の DataFrame。

    Raises:
        ValueError: 銘柄コードが不正、またはデータが取得できなかった場合。
    """
    df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
    if df is None or df.empty:
        raise ValueError(
            f"'{ticker}' の株価データを取得できませんでした。銘柄コードやネットワーク接続を確認してください。"
        )
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df[["Open", "High", "Low", "Close", "Volume"]]
