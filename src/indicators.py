"""テクニカル指標の計算関数群。"""

import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def rsi(series: pd.Series, window: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(
    series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
) -> pd.DataFrame:
    macd_line = ema(series, fast) - ema(series, slow)
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return pd.DataFrame(
        {"macd": macd_line, "signal": signal_line, "histogram": histogram}
    )


def bollinger_bands(series: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    mid = sma(series, window)
    std = series.rolling(window=window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    return pd.DataFrame({"upper": upper, "middle": mid, "lower": lower})


def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """OHLCVデータフレームに各種指標列を追加して返す。"""
    out = df.copy()
    close = out["Close"]

    out["sma_short"] = sma(close, 5)
    out["sma_long"] = sma(close, 25)
    out["rsi"] = rsi(close, 14)

    macd_df = macd(close)
    out["macd"] = macd_df["macd"]
    out["macd_signal"] = macd_df["signal"]
    out["macd_hist"] = macd_df["histogram"]

    bb_df = bollinger_bands(close)
    out["bb_upper"] = bb_df["upper"]
    out["bb_middle"] = bb_df["middle"]
    out["bb_lower"] = bb_df["lower"]

    return out
