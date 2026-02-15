#!/usr/bin/env python
# coding: utf-8

import pandas as pd
import sys
import os
from datetime import date, datetime
from thefuzz import process
import matplotlib.pyplot as plt

# ==========================================
# 1. CONFIGURATION & DATE LOGIC
# ==========================================
if len(sys.argv) > 1:
    group = sys.argv[1]
else:
    group = 'group_1' 

ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = f'day_{day_num}'
prev_day = f'day_{day_num - 1}'

# --- SMART FALLBACK ---
if not os.path.exists(f'./data/mvp_{day}.csv'):
    day = prev_day 
    if not os.path.exists(f'./data/mvp_{day}.csv'):
         day = 'day_1'

# Path for the "Site" content
leaderboard_file = "README.md" 
ipl_mock_auction_summary = f'./{group}/AuctionSummary.csv'

# ==========================================
# 2. DATA PROCESSING
# ==========================================
mvp_df = pd.read_csv(f'./data/mvp_{day}.csv')
mvp_df['Player'] = mvp_df['Player'].astype(str).str.lower().str.strip()

fantasy_teams_df = pd.read_csv(ipl_mock_auction_summary).apply(lambda x: x.astype(str).str.lower().str.strip())
fantasy_mgrs = fantasy_teams_df.columns.to_list()

scores = { mgr:0 for mgr in fantasy_mgrs }
ownership_list = []

for mgr in fantasy_mgrs:
    mvp_players_list = mvp_df['Player'].to_list()
    for player in fantasy_teams_df[mgr]:
        player_name = str(player)
        pts = 0.0
        if player_name in mvp_players_list:
            pts = float(mvp_df.loc[mvp_df['Player'] == player_name, 'Pts'].iloc[0])
            scores[mgr] += pts
        if player_name != 'nan':
            ownership_list.append({'Player': player_name.title(), 'Manager': mgr, 'Points': pts})

# ==========================================
# 3. GENERATE THE WEB DASHBOARD (README.md)
# ==========================================
print(f"🚀 Updating Suddu Repo Site for {day}...")

scores_df = pd.DataFrame(sorted(scores.items(), key=lambda x: x[1], reverse=True), columns=['Manager', 'Total Points'])
ownership_df = pd.DataFrame(ownership_list).sort_values(by='Points', ascending=False)

# Build the Web Content
now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
report = f"# 🏏 T20 World Cup 2026 Fantasy League\n"
report += f"📅 **Tournament Day:** {day.replace('_', ' ').upper()} | 🕒 **Last Update:** {now}\n\n"

report += "### 🏆 Current Standings\n"
report += scores_df.to_markdown(index=False) + "\n\n"

report += "---\n\n"

report += "### 🕵️ Player Ownership & Points\n"
report += "Use `Ctrl + F` to find your players!\n\n"
report += ownership_df.to_markdown(index=False) + "\n\n"

report += "---\n"
report += "⚡ *Data automatically synced from suddu-backend services.*"

with open(leaderboard_file, 'w') as f:
    f.write(report)

# ==========================================
# 4. PLAYER CHART
# ==========================================
top_10 = mvp_df.sort_values(by='Pts', ascending=False).head(10)
plt.figure(figsize=(10, 6)) 
plt.bar(top_10['Player'].str.title(), top_10['Pts'], color='#1f77b4')
plt.title(f'Top 10 Players - {day.upper()}')
plt.xticks(rotation=45, ha='right') 
plt.tight_layout()
plt.savefig('leaderboard.png')

print(f"✅ Site Updated! Just push to see it live.")

# ==========================================
# 7. WEB INTEGRATION: WHO OWNS WHO
# ==========================================
print("🌐 Syncing Ownership Data to Website...")

try:
    ownership_list = []
    for mgr in fantasy_teams_df.columns:
        for player in fantasy_teams_df[mgr]:
            player_clean = str(player).strip()
            if player_clean and player_clean != 'nan':
                pts = 0
                match = mvp_df[mvp_df['Player'] == player_clean]
                if not match.empty:
                    pts = float(match.iloc[0]['Pts'])
                
                ownership_list.append({
                    'Player': player_clean.title(),
                    'Manager': mgr, 
                    'Points': pts
                })

    ownership_df = pd.DataFrame(ownership_list)
    # Sort by points so the website shows the best players first
    ownership_df = ownership_df.sort_values(by='Points', ascending=False)
    
    # SAVE THIS SPECIFIC FILENAME - the website template looks for this
    site_file_path = f'./{group}/player_ownership_web.csv'
    ownership_df.to_csv(site_file_path, index=False)
    
    print(f"✅ Web data synced to {site_file_path}")

except Exception as e:
    print(f"❌ Web Sync Error: {e}")

# ==========================================
# 8. SQUAD & OWNERSHIP VIEW FOR THE WEBSITE
# ==========================================
print("🌐 Formatting squads for web view...")
with open(f"./{group}/squads_live.md", "w") as f:
    f.write("# 🏏 Official Player Ownership & Squads\n\n")
    for mgr in fantasy_mgrs:
        f.write(f"### 🛡️ {mgr.upper()}'S SQUAD\n")
        # Filter ownership list for this manager
        mgr_players = [p for p in ownership_list if p['Manager'] == mgr]
        mgr_df = pd.DataFrame(mgr_players)[['Player', 'Points']]
        f.write(mgr_df.to_markdown(index=False) + "\n\n")

# ==========================================
# 9. WEBSITE INTEGRATION (The "Live" Site)
# ==========================================
print("🌐 Formatting data for the web interface...")

try:
    web_rows = []
    # Using the correct variable name: fantasy_teams_df
    for mgr in fantasy_teams_df.columns:
        for player in fantasy_teams_df[mgr]:
            p_name = str(player).strip().lower()
            if p_name != 'nan' and p_name != '':
                pts = 0.0
                # Match points from your mvp_df
                if p_name in mvp_df['Player'].values:
                    pts = float(mvp_df.loc[mvp_df['Player'] == p_name, 'Pts'].iloc[0])
                
                web_rows.append({
                    "Manager": mgr.upper(),
                    "Player": p_name.title(),
                    "Points": pts
                })

    # Create the DataFrame
    web_output_df = pd.DataFrame(web_rows).sort_values(by="Points", ascending=False)

    # 1. Save as CSV (for the site's data folder)
    web_output_df.to_csv(f'./{group}/squads_live.csv', index=False)

    # 2. Save as HTML (This is what actually shows up on a website!)
    # We will save this as 'ownership.html'
    html_table = web_output_df.to_html(classes='table table-striped', index=False)
    with open(f"./{group}/ownership.html", "w") as f:
        f.write(html_table)

    print(f"✅ Website data ready in ./{group}/squads_live.csv and ownership.html")

except Exception as e:
    print(f"❌ Web Sync Error: {e}")