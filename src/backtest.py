"""シグナルロジックの過去検証を行う簡易バックテストエンジン。

ロング・オンリー(空売りなし)で、「買い」シグナルで全力買い、
「売り」シグナルで全売却するだけの単純な戦略をシミュレーションする。
手数料・スリッページは考慮しない簡易版。
"""

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class Trade:
    entry_date: pd.Timestamp
    entry_price: float
    exit_date: pd.Timestamp
    exit_price: float

    @property
    def return_pct(self) -> float:
        return (self.exit_price - self.entry_price) / self.entry_price * 100


@dataclass
class BacktestResult:
    equity_curve: pd.Series
    trades: list[Trade] = field(default_factory=list)
    initial_cash: float = 1_000_000.0

    @property
    def final_equity(self) -> float:
        return self.equity_curve.iloc[-1]

    @property
    def total_return_pct(self) -> float:
        return (self.final_equity - self.initial_cash) / self.initial_cash * 100

    @property
    def buy_and_hold_return_pct(self) -> float:
        return (
            self.equity_curve.attrs["close_end"] - self.equity_curve.attrs["close_start"]
        ) / self.equity_curve.attrs["close_start"] * 100

    @property
    def win_rate_pct(self) -> float:
        if not self.trades:
            return 0.0
        wins = sum(1 for t in self.trades if t.return_pct > 0)
        return wins / len(self.trades) * 100

    @property
    def max_drawdown_pct(self) -> float:
        running_max = self.equity_curve.cummax()
        drawdown = (self.equity_curve - running_max) / running_max * 100
        return drawdown.min()

    def summary(self) -> dict:
        return {
            "初期資金": self.initial_cash,
            "最終評価額": round(self.final_equity, 0),
            "トータルリターン(%)": round(self.total_return_pct, 2),
            "Buy&Holdリターン(%)": round(self.buy_and_hold_return_pct, 2),
            "取引回数": len(self.trades),
            "勝率(%)": round(self.win_rate_pct, 2),
            "最大ドローダウン(%)": round(self.max_drawdown_pct, 2),
        }


def run_backtest(signal_df: pd.DataFrame, initial_cash: float = 1_000_000.0) -> BacktestResult:
    """シグナル付きDataFrame(signals.generate_signalsの出力)でバックテストする。"""
    cash = initial_cash
    shares = 0.0
    trades: list[Trade] = []
    entry_date = None
    entry_price = None

    equity_values = []
    for date, row in signal_df.iterrows():
        price = row["Close"]
        signal = row["signal"]

        if signal == "買い" and shares == 0:
            shares = cash / price
            cash = 0.0
            entry_date, entry_price = date, price
        elif signal == "売り" and shares > 0:
            cash = shares * price
            trades.append(Trade(entry_date, entry_price, date, price))
            shares = 0.0
            entry_date = entry_price = None

        equity_values.append(cash + shares * price)

    equity_curve = pd.Series(equity_values, index=signal_df.index, name="equity")
    equity_curve.attrs["close_start"] = signal_df["Close"].iloc[0]
    equity_curve.attrs["close_end"] = signal_df["Close"].iloc[-1]

    return BacktestResult(equity_curve=equity_curve, trades=trades, initial_cash=initial_cash)
