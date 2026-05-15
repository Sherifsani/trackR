Ai layer for trackR
Activity tracking across employee
Liveness check every two hours
Overtime tracking
Intelligence layer 


Research how anomaly detection could work here
daily/weekly digest for both employees/employers


2. Well-being Stream: Detecting "Digital Exhaustion"
Detecting burnout requires looking at the longitudinal decay of work patterns. It is less about a single "red alert" and more about a shift in the baseline.

Key Indicators
The "Always-On" Pattern: A transition from defined work hours to "fragmented" work (e.g., sending messages at 11 PM, 2 AM, and 7 AM). This indicates a lack of recovery time.
Context-Switching Fatigue: An increase in the frequency of switching between tabs or applications without meaningful "deep work" blocks.
Engagement Decay: A statistical drop in the "velocity of contribution" (e.g., fewer lines of code, fewer resolved tickets, or shorter messages) compared to their own 90-day rolling average.

Suggested Model: LSTM (Long Short-Term Memory)
LSTMs are excellent for this because they "remember" the past. They can learn that a user is usually productive in the mornings and detect when that person’s morning productivity has been consistently sliding for three weeks, a classic sign of burnout.

Handles edge cases: what happens when data is incomplete, forged, or
Adversarial?

manual input for justification/remarks for hiccups during the day.
Masking as a Feature: Instead of just filling gaps, treat the "absence of data" as a feature itself. If a user’s data suddenly stops for exactly 60 minutes every day, that pattern is more informative than a random dropout.
yes
