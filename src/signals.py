"""複数指標を重み付けスコアリングして売買シグナルを判定する。

単一指標だけで判定するとダマシ(誤シグナル)が多いため、
移動平均クロス・RSI・MACD・ボリンジャーバンドの4指標を合議させ、
合計スコアが閾値を超えたときだけ「買い」「売り」と判定する。
"""

import pandas as pd

from src.indicators import add_all_indicators

BUY_THRESHOLD = 2
SELL_THRESHOLD = -2

RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70


def _sma_cross_score(df: pd.DataFrame) -> pd.Series:
    above = df["sma_short"] > df["sma_long"]
    prev_above = above.shift(1)
    golden_cross = above & ~prev_above.fillna(False)
    dead_cross = ~above & prev_above.fillna(False)

    score = pd.Series(0, index=df.index, dtype=float)
    score[above] = 1
    score[~above] = -1
    score[golden_cross] = 2
    score[dead_cross] = -2
    return score


def _rsi_score(df: pd.DataFrame) -> pd.Series:
    score = pd.Series(0, index=df.index, dtype=float)
    score[df["rsi"] < RSI_OVERSOLD] = 1
    score[df["rsi"] > RSI_OVERBOUGHT] = -1
    return score


def _macd_score(df: pd.DataFrame) -> pd.Series:
    above = df["macd"] > df["macd_signal"]
    prev_above = above.shift(1)
    cross_up = above & ~prev_above.fillna(False)
    cross_down = ~above & prev_above.fillna(False)

    score = pd.Series(0, index=df.index, dtype=float)
    score[cross_up] = 1
    score[cross_down] = -1
    return score


def _bollinger_score(df: pd.DataFrame) -> pd.Series:
    score = pd.Series(0, index=df.index, dtype=float)
    score[df["Close"] <= df["bb_lower"]] = 1
    score[df["Close"] >= df["bb_upper"]] = -1
    return score


def generate_signals(price_df: pd.DataFrame) -> pd.DataFrame:
    """OHLCVデータからスコアと売買シグナル列を付与したDataFrameを返す。

    Returns:
        add_all_indicators の出力に加え、以下の列を持つ:
        score_sma_cross, score_rsi, score_macd, score_bollinger,
        score (合計), signal ("買い" / "売り" / "様子見")
    """
    df = add_all_indicators(price_df)

    df["score_sma_cross"] = _sma_cross_score(df)
    df["score_rsi"] = _rsi_score(df)
    df["score_macd"] = _macd_score(df)
    df["score_bollinger"] = _bollinger_score(df)
    df["score"] = (
        df["score_sma_cross"] + df["score_rsi"] + df["score_macd"] + df["score_bollinger"]
    )

    df["signal"] = "様子見"
    df.loc[df["score"] >= BUY_THRESHOLD, "signal"] = "買い"
    df.loc[df["score"] <= SELL_THRESHOLD, "signal"] = "売り"

    return df


def latest_signal(signal_df: pd.DataFrame) -> dict:
    """最新日のシグナルと内訳を辞書で返す(ダッシュボード表示用)。"""
    last = signal_df.iloc[-1]
    return {
        "date": signal_df.index[-1],
        "close": last["Close"],
        "signal": last["signal"],
        "score": last["score"],
        "breakdown": {
            "移動平均クロス": last["score_sma_cross"],
            "RSI": last["score_rsi"],
            "MACD": last["score_macd"],
            "ボリンジャーバンド": last["score_bollinger"],
        },
    }
