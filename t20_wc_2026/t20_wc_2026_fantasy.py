import pandas as pd
import sys
import os
import matplotlib.pyplot as plt
import time
from datetime import date

# ==========================================
# 1. SETUP & PATHS
# ==========================================
# Update these to your actual GitHub details for the mobile image fix
USERNAME = "suddu16"
REPO = "cricket-fantasy"

group = sys.argv[1] if len(sys.argv) > 1 else 'group_1'
# Logic to detect day based on tournament start
ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = f'day_{day_num}'

# Fallback to the latest available file if today's isn't ready
if not os.path.exists(f'./data/mvp_{day}.csv'):
    files = sorted([f for f in os.listdir('./data/') if f.startswith('mvp_day_')], 
                   key=lambda x: int(x.split('_')[2].split('.')[0]), reverse=True)
    day = files[0].replace('mvp_', '').replace('.csv', '') if files else 'day_1'

print(f"🚀 Processing data for {day.upper()}...")

# ==========================================
# 2. LOAD DATA
# ==========================================
mvp_df = pd.read_csv(f'./data/mvp_{day}.csv')
mvp_df['Player'] = mvp_df['Player'].astype(str).str.lower().str.strip()

auction_file = f'./{group}/AuctionSummary.csv'
fantasy_teams_df = pd.read_csv(auction_file)
fantasy_teams_df.columns = fantasy_teams_df.columns.str.strip()
fantasy_mgrs = fantasy_teams_df.columns.tolist()

# ==========================================
# 3. MAPPING OWNERS & CALCULATING SCORES
# ==========================================
player_to_owner = {}
scores = {mgr: 0.0 for mgr in fantasy_mgrs}

for mgr in fantasy_mgrs:
    mgr_players = fantasy_teams_df[mgr].dropna().astype(str).str.lower().str.strip().tolist()
    for p in mgr_players:
        player_to_owner[p] = mgr.upper()
        
    mgr_pts = mvp_df[mvp_df['Player'].isin(mgr_players)]['Pts'].sum()
    scores[mgr] = round(mgr_pts, 2)

mvp_df['Owner'] = mvp_df['Player'].map(player_to_owner).fillna('UNDRAFTED')
mvp_df['Player'] = mvp_df['Player'].str.title()

# ==========================================
# 4. GENERATE WEB ASSETS
# ==========================================
scores_df = pd.DataFrame(list(scores.items()), columns=['Manager', 'Total Points']).sort_values(by='Total Points', ascending=False)
mvp_df.to_csv(f'./data/mvp_{day}.csv', index=False)

# Ownership table for the web
ownership_rows = []
for p, m in player_to_owner.items():
    pts = mvp_df[mvp_df['Player'].str.lower() == p]['Pts'].sum()
    ownership_rows.append({"Player": p.title(), "Manager": m, "Points": pts})

ownership_df = pd.DataFrame(ownership_rows).sort_values(by="Points", ascending=False)
ownership_df.to_csv(f'./{group}/squads_live.csv', index=False)
ownership_df.to_html(f'./{group}/ownership.html', classes='table table-striped', index=False)

# ==========================================
# 5. FANCY VISUALS (SPEED OPTIMIZED)
# ==========================================
print("🎨 Generating beauty visuals...")
plt.style.use('dark_background')

# --- PIE CHART ---
plt.figure(figsize=(8, 8))
plt.pie(scores_df['Total Points'], labels=scores_df['Manager'], autopct='%1.1f%%', colors=plt.cm.Paired(range(len(scores_df))))
plt.title('League Points Distribution', fontsize=15)
plt.savefig(f'./{group}/manager_distribution.png', bbox_inches='tight')
plt.close()

# --- TREND GRAPH (High Speed History) ---
plt.figure(figsize=(10, 5))
history_data = {mgr: [0] for mgr in fantasy_mgrs}
days_available = sorted([f for f in os.listdir('./data/') if f.startswith('mvp_day_')], 
                        key=lambda x: int(x.split('_')[2].split('.')[0]))

for d_file in days_available:
    temp_df = pd.read_csv(f'./data/{d_file}')
    temp_df['Player'] = temp_df['Player'].astype(str).str.lower().str.strip()
    for mgr in fantasy_mgrs:
        mgr_players = fantasy_teams_df[mgr].dropna().astype(str).str.lower().str.strip().tolist()
        pts = temp_df[temp_df['Player'].isin(mgr_players)]['Pts'].sum()
        history_data[mgr].append(pts)

for mgr, trend in history_data.items():
    plt.plot(trend, marker='o', label=mgr, linewidth=2.5)

plt.title('📈 Performance Progression', fontsize=16, pad=20)
plt.xlabel('Tournament Days')
plt.ylabel('Cumulative Points')
plt.legend(loc='center left', bbox_to_anchor=(1, 0.5))
plt.grid(True, linestyle=':', alpha=0.3)
plt.tight_layout()
plt.savefig(f'./{group}/points_trend.png', dpi=150)
plt.close()

# ==========================================
# 6. MOBILE-FRIENDLY README (CACHE BUSTER)
# ==========================================
ts = int(time.time()) # Timestamp to force mobile refresh
trend_raw = f"https://raw.githubusercontent.com/{USERNAME}/{REPO}/main/{group}/points_trend.png?v={ts}"
dist_raw = f"https://raw.githubusercontent.com/{USERNAME}/{REPO}/main/{group}/manager_distribution.png?v={ts}"

with open("README.md", "w") as f:
    f.write(f"# 🏏 T20 WC 2026 Fantasy - {group.upper()}\n\n")
    f.write("## 📈 Performance Visuals\n")
    f.write(f"![Trend Graph]({trend_raw})\n\n")
    f.write(f"![Distribution]({dist_raw})\n\n")
    f.write("--- \n\n")
    f.write("## 🏆 Standings\n")
    f.write(scores_df.to_markdown(index=False) + "\n\n")
    f.write("## 🕵️ Who Owns Whom (Top 10)\n")
    f.write(mvp_df.head(10)[['Player', 'Pts', 'Owner']].to_markdown(index=False) + "\n\n")

print(f"✅ Full Update Complete! Images optimized for mobile with timestamp {ts}")