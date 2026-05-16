# trackR — Product Overview

## What It Is

trackR is a remote employee time-tracking and workforce intelligence platform built for small-to-medium teams. It lets employers monitor active work hours, verify what employees were actually doing during those hours, and pay them directly — all from one dashboard.

---

## The Problem It Solves

Remote work creates a trust gap. Employers can't see whether a hired worker is actually working, or just has their laptop open. Timesheet-based systems are easy to fake. Screen recording tools feel invasive and generate too much noise. trackR takes a middle path: it tracks browser activity automatically via a Chrome extension, giving admins a factual, categorized record of what each employee worked on each day — without recording screens or capturing keystrokes.

On the payment side, paying remote contractors is friction-heavy — calculating hours, applying overtime, and then doing manual bank transfers. trackR automates all of that.

---

## Core Features

### Clock In / Clock Out
Employees clock in and out via either the web dashboard or the Chrome extension popup. The system records the full session duration and associates all browser activity captured during that window with the session.

### Chrome Extension Activity Tracking
A Chrome MV3 extension runs silently in the background while the employee is clocked in. It tracks:
- Every tab visited (domain and page title)
- Time spent on each tab (dwell time)
- Idle vs. active states (via Chrome's idle detection)
- Window focus/blur events
- Google Meet call detection (via content script)
- Enriched GitHub page titles (repo name, PR number, etc.)

Activity is buffered locally and synced to the server every minute, with an eager 5-second sync after tab events and a 30-second checkpoint to support live admin monitoring.

### Activity Categorization
Every domain visited is classified into a productive category — development, design, meetings, documentation, project management, research, communications — or flagged as off-task or other. This categorization is the basis for all productivity scoring and reporting.

### Live Activity Feed (Employee View)
While clocked in, employees see a real-time stream of their own activity — a timestamped list of every site they visited and how long they spent there. The dashboard polls every 3 seconds so it stays current.

### Session Summary (Employee View)
After clocking out, the employee sees a full session recap: total time worked, breakdown by category, top sites visited by time, and a chronological event log for the session.

### Break Tracking
Employees can start and end breaks during an active session. Break time is tracked separately and deducted from billable hours when calculating pay.

---

## Admin Dashboard

### Team Overview
Admins see a real-time overview of the entire team: who is currently clocked in, who is idle, who hasn't shown up. Each employee card shows their live status and time clocked in today.

### Per-Employee Session History
Admins can drill into any employee's work history — a paginated list of all past sessions with clock-in/out times, duration, and approval status.

### Session Analysis (AI-Powered)
When an admin views a completed session, trackR uses Gemini 2.5 Flash to analyze the session's activity data and return:
- An overall productivity score (0–100) and letter grade (A–F)
- A plain-English summary of what was worked on
- Productive time percentage
- Up to 3 highlights (positive observations)
- Up to 3 concerns or flags

Analysis is triggered on demand and cached on the session record.

### Cross-Session Work Pattern Insights (AI-Powered)
After each session analysis, the system computes 30-day behavioral patterns for the employee and sends them to Gemini for a narrative insight report. This includes:
- Peak productive hours of the day
- Best day of the week
- Fatigue profile (how productivity changes across early, mid, and late session thirds)
- Context-switching rate (domain changes per productive hour)
- Focus depth (average time per site)
- Warm-up time (minutes before first productive activity)
- Trend direction: improving, stable, or declining

The narrative includes a headline, three actionable observations, a fatigue flag, and any detected behavioral anomalies.

### Per-Employee Settings
Admins can configure per-employee pay settings:
- Hourly rate (NGN)
- Standard work hours per day
- Allowed break minutes per day
- Overtime multiplier

---

## Anomaly Detection

trackR runs two independent anomaly detection streams in the background.

### Security Stream
Detects suspicious or erratic browser behavior:

- **Velocity Anomaly** — Measures the employee's current tab-open rate against their 30-day baseline using z-score analysis. Flags sessions where activity rate is 2+ standard deviations above normal, which may indicate automated browsing or data exfiltration.
- **Rapid Context Switching** — Flags sessions where more than 45% of tab visits lasted under 8 seconds. Extreme ratios trigger high-severity flags and may indicate scripted navigation.

### Wellbeing Stream
Detects patterns associated with overwork or burnout:

- **Off-Hours Work** — Flags sessions where a significant portion of activity occurred before 6am or after 10pm UTC.
- **Context-Switching Fatigue** — Analyzes average tab dwell time across the last 5 sessions. Employees averaging under 45 seconds per site are flagged; under 15 seconds triggers a high-severity flag.
- **Engagement Decay** — Tracks productive time percentage across the last 10 analyzed sessions. A drop of 10+ percentage points between the older half and the recent half triggers a declining engagement flag.

All anomaly flags are persisted with their severity level, score, and a human-readable message. Admins can view and resolve flags from the dashboard.

---

## Payroll & Payments

### Automated Pay Calculation
When an admin initiates a payment for an employee over a given date range, the system automatically:
- Sums all session durations in the period
- Deducts break time
- Separates regular hours from overtime (anything beyond the employee's configured daily hours threshold)
- Applies the overtime multiplier to overtime hours
- Calculates total pay in NGN based on the employee's hourly rate

### Bank Account Verification
Employees enter their Nigerian bank details (bank name and account number) through their profile. The system calls the Squad API to verify the account and confirm the account holder name before storing the details. Pay cannot be disbursed to an unverified account.

### One-Click Disbursement (Squad)
Admins disburse payments via Squad's payout API. A single click triggers a bank transfer to the employee's verified account. The system stores the Squad transaction reference and NIP reference for reconciliation. Disbursement statuses (pending, paid, failed) are tracked with failure reasons when applicable.

### Payroll Wallet
The admin maintains a payroll wallet funded via Squad's payment collection flow. Admins top up the wallet by making a card payment through a Squad-hosted checkout page. Webhook confirmation from Squad marks the top-up as confirmed. The wallet balance is derived from confirmed top-ups minus paid-out amounts.

---

## Authentication & Onboarding

### Role-Based Auth
Two roles: admin and employee. Login is email/password with a JWT cookie (7-day expiry). All routes are protected by middleware that enforces the correct role.

### Employee Invite Flow
Admins invite employees by email. The system generates a time-limited invite token and sends it via email. Employees follow the link to set their password and activate their account — no admin-manual account creation required.

---

## Extension Integration

The web app and Chrome extension stay in sync through a custom event system. When an employee logs in on the web, the app writes their credentials to localStorage and fires a DOM event. The extension's content script picks this up and authenticates the background worker. Clock-in from the web page is relayed to the extension in the same way, keeping the popup UI in sync with the dashboard.

---

## Tech Stack (Summary)

Built on Next.js (App Router), TypeScript, Tailwind CSS v4, Prisma + PostgreSQL, and jose for JWT. The Chrome extension is MV3. AI analysis runs on Google Gemini 2.5 Flash. Payments are processed through Squad (Nigerian payment infrastructure). The UI is dark-first with amber accents.
