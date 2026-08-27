"""Yahoo Finance へのアクセスに依存しない、テスト用の合成OHLCVデータ生成。"""

import numpy as np
import pandas as pd


def make_synthetic_ohlcv(n: int = 250, seed: int = 42) -> pd.DataFrame:
    """トレンド+サイクル+ノイズを持つ合成日足データを生成する。

    ゴールデンクロス/デッドクロスや売られすぎ/買われすぎが
    自然に発生するように、緩やかなサイン波トレンドを重ねている。
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2024-01-04", periods=n)

    t = np.arange(n)
    trend = 0.05 * t
    cycle = 40 * np.sin(2 * np.pi * t / 60)
    noise = rng.normal(0, 5, size=n)
    close = 1000 + trend + cycle + noise
    close = np.maximum(close, 10)  # 価格が非正にならないようにする

    daily_range = np.abs(rng.normal(5, 2, size=n))
    open_ = close + rng.normal(0, 2, size=n)
    high = np.maximum(open_, close) + daily_range
    low = np.minimum(open_, close) - daily_range
    volume = rng.integers(1_000_000, 5_000_000, size=n)

    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )
