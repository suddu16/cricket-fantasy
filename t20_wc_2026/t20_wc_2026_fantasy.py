import pandas as pd
import sys
import os
import matplotlib.pyplot as plt
from datetime import date

# ==========================================
# 1. SETUP & PATHS
# ==========================================
group = sys.argv[1] if len(sys.argv) > 1 else 'group_1'
# Logic to detect current day based on tournament start (Feb 6, 2026)
ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = f'day_{day_num}'

# Fallback to the latest available file if today's isn't ready
if not os.path.exists(f'./data/mvp_{day}.csv'):
    files = sorted([f for f in os.listdir('./data/') if f.startswith('mvp_day_')], reverse=True)
    day = files[0].replace('mvp_', '').replace('.csv', '') if files else 'day_1'

print(f"🚀 Processing data for {day.upper()}...")

# ==========================================
# 2. LOAD DATA
# ==========================================
mvp_df = pd.read_csv(f'./data/mvp_{day}.csv')
mvp_df['Player'] = mvp_df['Player'].astype(str).str.lower().str.strip()

auction_file = f'./{group}/AuctionSummary.csv'
fantasy_teams_df = pd.read_csv(auction_file)
# Clean columns and data
fantasy_teams_df.columns = fantasy_teams_df.columns.str.strip()
fantasy_mgrs = fantasy_teams_df.columns.tolist()

# ==========================================
# 3. MAPPING OWNERS & CALCULATING SCORES
# ==========================================
player_to_owner = {}
scores = {mgr: 0.0 for mgr in fantasy_mgrs}

for mgr in fantasy_mgrs:
    # Get clean list of players for this manager
    mgr_players = fantasy_teams_df[mgr].dropna().astype(str).str.lower().str.strip().tolist()
    
    # Map each player to this manager
    for p in mgr_players:
        player_to_owner[p] = mgr.upper()
        
    # Calculate score for this manager (Vectorized for speed)
    mgr_pts = mvp_df[mvp_df['Player'].isin(mgr_players)]['Pts'].sum()
    scores[mgr] = round(mgr_pts, 2)

# Add Owner field to MVP leaderboard
mvp_df['Owner'] = mvp_df['Player'].map(player_to_owner).fillna('UNDRAFTED')
mvp_df['Player'] = mvp_df['Player'].str.title()

# ==========================================
# 4. GENERATE WEB ASSETS (CSV & HTML)
# ==========================================
# Create the Standings DataFrame
scores_df = pd.DataFrame(list(scores.items()), columns=['Manager', 'Total Points']).sort_values(by='Total Points', ascending=False)

# Save the updated MVP file with Owners (the website reads this)
mvp_df.to_csv(f'./data/mvp_{day}.csv', index=False)

# Save the Squads/Ownership file
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
plt.style.use('dark_background') # Aesthetic dark mode for web

# --- PIE CHART (Points Share) ---
plt.figure(figsize=(8, 8))
plt.pie(scores_df['Total Points'], labels=scores_df['Manager'], autopct='%1.1f%%', colors=plt.cm.viridis(range(len(scores_df))))
plt.title('League Points Distribution')
plt.savefig(f'./{group}/manager_distribution.png')
plt.close()

# --- TREND GRAPH (The Speed Fix) ---
plt.figure(figsize=(10, 5))
history_data = {mgr: [0] for mgr in fantasy_mgrs}
days_available = sorted([f for f in os.listdir('./data/') if f.startswith('mvp_day_')], key=lambda x: int(x.split('_')[2].split('.')[0]))

for d_file in days_available:
    temp_df = pd.read_csv(f'./data/{d_file}')
    temp_df['Player'] = temp_df['Player'].astype(str).str.lower().str.strip()
    for mgr in fantasy_mgrs:
        mgr_players = fantasy_teams_df[mgr].dropna().astype(str).str.lower().str.strip().tolist()
        pts = temp_df[temp_df['Player'].isin(mgr_players)]['Pts'].sum()
        history_data[mgr].append(pts)

for mgr, trend in history_data.items():
    plt.plot(trend, marker='o', label=mgr, linewidth=2)

plt.title('The Race to the Top')
plt.xlabel('Days')
plt.ylabel('Points')
plt.legend(loc='upper left', bbox_to_anchor=(1, 1))
plt.tight_layout()
plt.savefig(f'./{group}/points_trend.png')
plt.close()

# ==========================================
# 6. UPDATE README (FOR THE LIVE WEBSITE)
# ==========================================
# Your GitHub Username and Repo Name
username = "suddu16"
repo = "cricket-fantasy"

# Create RAW links that GitHub Pages loves
trend_url = f"https://raw.githubusercontent.com/{username}/{repo}/main/{group}/points_trend.png"
dist_url = f"https://raw.githubusercontent.com/{username}/{repo}/main/{group}/manager_distribution.png"

with open("README.md", "w") as f:
    f.write(f"# 🏏 T20 WC 2026 Fantasy - {group.upper()}\n\n")
    
    f.write("## 📈 Performance Visuals\n")
    # Using the RAW links ensures the website can find them
    f.write(f"![Trend Graph]({trend_url})\n\n")
    f.write(f"![Points Distribution]({dist_url})\n\n")
    
    f.write("--- \n\n")
    f.write("## 🏆 Standings\n")
    f.write(scores_df.to_markdown(index=False) + "\n\n")
    
    f.write("## 🕵️ Who Owns Whom (Top 10)\n")
    f.write(mvp_df.head(10)[['Player', 'Pts', 'Owner']].to_markdown(index=False) + "\n\n")

print("✅ README updated with absolute image paths!")
print(f"✅ Full update complete for {day}! Ready to push.")