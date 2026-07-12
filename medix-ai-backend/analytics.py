import pandas as pd
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from typing import List, Dict, Any

def forecast_demand(sales_history: List[Dict[str, Any]], forecast_days: int = 15) -> Dict[str, Any]:
    """
    Generate inventory demand forecast using Holt-Winters Exponential Smoothing.
    Expects sales_history format: [{"date": "YYYY-MM-DD", "quantity": 10}]
    """
    if len(sales_history) < 3:
        # Fallback if too few data points: return average demand
        avg_qty = np.mean([item["quantity"] for item in sales_history]) if sales_history else 0
        forecast_dates = pd.date_range(
            start=pd.Timestamp.now() + pd.Timedelta(days=1), 
            periods=forecast_days
        )
        return {
            "forecast": [{"date": d.strftime("%Y-%m-%d"), "predicted_quantity": float(avg_qty)} for d in forecast_dates],
            "average_daily_demand": float(avg_qty),
            "suggested_safety_stock": float(avg_qty * 3),
            "reorder_point": float(avg_qty * 5),
            "model_used": "Average Demand Fallback"
        }
        
    # Load into pandas DataFrame
    df = pd.DataFrame(sales_history)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").set_index("date")
    
    # Resample to daily frequency, filling missing dates with 0
    df = df.resample("D").sum().fillna(0)
    
    # Run Holt-Winters Exponential Smoothing
    try:
        # Use additive trend and no seasonal component (since history might be short)
        model = ExponentialSmoothing(
            df["quantity"], 
            trend="add", 
            seasonal=None, 
            initialization_method="estimated"
        )
        fit = model.fit()
        predictions = fit.forecast(forecast_days)
    except Exception as e:
        # Fallback to simple moving average
        avg_qty = df["quantity"].mean()
        predictions = pd.Series(
            [avg_qty] * forecast_days, 
            index=pd.date_range(start=df.index[-1] + pd.Timedelta(days=1), periods=forecast_days)
        )
        
    forecast_list = []
    for date, val in predictions.items():
        forecast_list.append({
            "date": date.strftime("%Y-%m-%d"),
            "predicted_quantity": max(0.0, float(val)) # Ensure non-negative predictions
        })
        
    # Calculate key inventory levels
    avg_demand = float(df["quantity"].mean())
    std_demand = float(df["quantity"].std()) if len(df) > 1 else 0.0
    
    # Safety Stock formula: Z-score (1.65 for 95% service level) * Lead Time Std Dev
    # Assuming lead time is 3 days
    safety_stock = float(1.65 * std_demand * np.sqrt(3)) if std_demand > 0 else float(avg_demand * 1.5)
    reorder_point = float((avg_demand * 3) + safety_stock) # 3 days lead time
    
    return {
        "forecast": forecast_list,
        "average_daily_demand": avg_demand,
        "suggested_safety_stock": max(0.0, safety_stock),
        "reorder_point": max(0.0, reorder_point),
        "model_used": "Holt-Winters Exponential Smoothing"
    }
