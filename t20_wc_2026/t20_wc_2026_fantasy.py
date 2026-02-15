#!/usr/bin/env python
# coding: utf-8

import pandas as pd
import sys
import os
from datetime import date
from thefuzz import process
import matplotlib.pyplot as plt

# ==========================================
# 1. CONFIGURATION & SETUP
# ==========================================
pd.set_option('display.max_colwidth', 200)
pd.set_option('display.max_columns', None)

if len(sys.argv) > 1:
    group = sys.argv[1]
else:
    group = 'group_1' 

print(f"📂 Working on Group: {group}")

# Date Logic
ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = 'day_' + str(day_num)
prev_day = 'day_' + str(day_num - 1)

# --- SMART FALLBACK LOGIC ---
if not os.path.exists(f'./data/mvp_{day}.csv'):
    print(f"⚠️  Data for {day} (Today) not found.")
    day = prev_day 
    prev_day_num = int(day.split('_')[1]) - 1
    prev_day = f'day_{prev_day_num}'
    print(f"🔄 Falling back to {day} (Yesterday) for the report.")

    if not os.path.exists(f'./data/mvp_{day}.csv'):
         print(f"❌ Yesterday's data also missing. Defaulting to day_1.")
         day = 'day_1'
         prev_day = 'day_0'
# ----------------------------

print(f"📅 Processing for: {day}")

tournament = 't20_wc_2026'
results_file = f'./{group}/{tournament}_results_{day}.csv'
prev_results_file = f'./{group}/{tournament}_results_{prev_day}.csv'
leaderboard_graph_file = f'./{group}/{tournament}_leaderboard.png'
leaderboard_file = f'./{group}/{tournament}_leaderboard.txt'
ipl_mock_auction_summary = f'./{group}/AuctionSummary.csv'

# ==========================================
# 2. LOAD DATA
# ==========================================
try:
    mvp_df = pd.read_csv(f'./data/mvp_{day}.csv')
    # Normalize player names in MVP data for better matching
    mvp_df['Player'] = mvp_df['Player'].astype(str).str.lower().str.strip()
except FileNotFoundError:
    print(f"❌ Error: Could not find ./data/mvp_{day}.csv.")
    sys.exit(1)

fantasy_teams_auction_df = pd.read_csv(ipl_mock_auction_summary)
fantasy_mgrs = fantasy_teams_auction_df.columns.to_list()

# Standardize Strings
fantasy_teams_df = fantasy_teams_auction_df.apply(lambda x: x.astype(str).str.lower().str.strip())

# Load/Create Manager CSVs
fantasy_teams_df_per_mgr = {}
for mgr in fantasy_teams_df.columns:
    mgr_file = f'./{group}/{mgr}.csv'
    if not os.path.exists(mgr_file):
        df = pd.DataFrame(fantasy_teams_df[mgr])
        df.to_csv(mgr_file, index=False)
    else:
        df = pd.read_csv(mgr_file)
    fantasy_teams_df_per_mgr[mgr] = df

# ==========================================
# 3. CALCULATE SCORES
# ==========================================
print("\n🔄 Calculating Scores...")
scores = { fantasy_mgr:0 for fantasy_mgr in fantasy_mgrs }

for mgr in fantasy_mgrs:
    mgr_df = fantasy_teams_df_per_mgr[mgr]
    mgr_day_pts = {}
    mgr_file = f'./{group}/{mgr}.csv'
    
    mvp_players_with_pts = mvp_df['Player'].to_list()
    
    for i in range(len(fantasy_teams_df[mgr])):
        player_name = str(fantasy_teams_df[mgr].iloc[i])
        
        if player_name in mvp_players_with_pts:
            player_score = float(mvp_df.loc[mvp_df['Player'] == player_name, 'Pts'].iloc[0])
            scores[mgr] += player_score
            mgr_day_pts[player_name] = player_score
        else:
            closest_match = process.extractOne(player_name, mvp_players_with_pts)
            # You could add logic here to auto-correct, but for now we set to 0
            mgr_day_pts[player_name] = 0.0
            
    mgr_df[f'{day}'] = mgr_df.iloc[:, 0].map(mgr_day_pts)
    mgr_df = mgr_df.reindex(sorted(mgr_df.columns, key = lambda x: int(x.split("_")[1] if '_' in x else 0)), axis=1)
    mgr_df.to_csv(mgr_file, index=False)

# ==========================================
# 4. 🚀 INSTANT LEADERBOARD
# ==========================================
print("\n" + "="*40)
print(f" 🏆 MANAGER STANDINGS ({day}) 🏆")
print("="*40)

scores_sorted = {k: v for k, v in sorted(scores.items(), key=lambda item: item[1], reverse=True)}
scores_msg_df = pd.DataFrame(scores_sorted.items(), columns=['Manager', 'Points'])

print(scores_msg_df.to_markdown(index=False))

leaderboard_table = f'*{day.upper()}*\n```\n{scores_msg_df.to_markdown(index=False)}\n```'
with open(leaderboard_file, 'w') as f:
    f.write(leaderboard_table)

print("\n... Generating graphs & reports in background ...")

# ==========================================
# 5. HISTORICAL TRACKING & LINE GRAPH
# ==========================================
if os.path.exists(prev_results_file):
    prev_scores = pd.read_csv(prev_results_file, header=None).T
    new_header = prev_scores.iloc[0]
    prev_scores = prev_scores[1:]
    prev_scores.columns = new_header
    prev_scores_dicts = prev_scores.to_dict(orient='records')
else:
    prev_scores_dicts = []

current_scores_dict = prev_scores_dicts + [scores]
graph_scores = pd.DataFrame(current_scores_dict)

graph_scores_t = graph_scores.T
graph_scores_t = graph_scores_t.sort_values(by=graph_scores_t.columns[-1], ascending=False)
graph_scores_t.to_csv(results_file, header=False)

ax = graph_scores.plot.line(marker='o')
ax.set_ylabel("Points")

final_scores = graph_scores.iloc[-1]
sorted_cols = final_scores.sort_values(ascending=False).index

position_changes = {}
if len(graph_scores) >= 2:
    prev_s = graph_scores.iloc[-2]
    prev_sorted = prev_s.sort_values(ascending=False).index
    prev_positions = {col: idx for idx, col in enumerate(prev_sorted)}
    curr_positions = {col: idx for idx, col in enumerate(sorted_cols)}
    for col in sorted_cols:
        position_changes[col] = prev_positions.get(col, 0) - curr_positions[col]
else:
    for col in sorted_cols: position_changes[col] = 0

handles, labels = ax.get_legend_handles_labels()
handle_dict = dict(zip(graph_scores.columns, handles))
sorted_handles = [handle_dict[col] for col in sorted_cols]
sorted_labels = []

for col in sorted_cols:
    change = position_changes[col]
    indicator = f" ▲{change}" if change > 0 else (f" ▼{abs(change)}" if change < 0 else "")
    sorted_labels.append(f"{col} ({int(final_scores[col])}){indicator}")

plt.legend(sorted_handles, sorted_labels, bbox_to_anchor=(1.02, 1), loc='upper left', borderaxespad=0)
plt.savefig(leaderboard_graph_file, bbox_inches="tight")
# plt.show()

# ==========================================
# 6. FEATURE: TOP 10 PLAYERS GRAPH
# ==========================================
print("📊 Generating 'leaderboard.png' (Top 10 Players)...")
try:
    if 'mvp_df' in locals():
        top_10 = mvp_df.sort_values(by='Pts', ascending=False).head(10)
        plt.figure(figsize=(10, 6)) 
        plt.bar(top_10['Player'], top_10['Pts'], color='skyblue')
        plt.title(f'Top 10 MVP Players ({day})')
        plt.xlabel('Player Name')
        plt.ylabel('Total Points')
        plt.xticks(rotation=45, ha='right') 
        plt.tight_layout()
        plt.savefig('leaderboard.png')
    else:
        print("❌ Error: mvp_df not found.")
except Exception as e:
    print(f"❌ Graph Error: {e}")

# ==========================================
# 7. FEATURE: WHO OWNS WHO? (Ownership Report)
# ==========================================
print("🕵️  Generating 'player_ownership.csv'...")

try:
    ownership_list = []
    # Loop through every manager's team
    for mgr in fantasy_teams_df.columns:
        for player in fantasy_teams_df[mgr]:
            player_clean = str(player).strip()
            
            # Skip empty rows or 'nan'
            if player_clean and player_clean != 'nan':
                # Find points for this player
                pts = 0
                match = mvp_df[mvp_df['Player'] == player_clean]
                if not match.empty:
                    pts = float(match.iloc[0]['Pts'])
                
                ownership_list.append({
                    'Player': player_clean.title(), # Capitalize name
                    'Manager': mgr, 
                    'Points': pts
                })

    # Create DataFrame and Save
    ownership_df = pd.DataFrame(ownership_list)
    # Sort by Points (descending) so best players are at top
    ownership_df = ownership_df.sort_values(by='Points', ascending=False)
    
    output_path = f'./{group}/player_ownership.csv'
    ownership_df.to_csv(output_path, index=False)
    print(f"✅ Success! Created '{output_path}'.")
    print("   -> Open this file to search for any player!")

except Exception as e:
    print(f"❌ Ownership Report Error: {e}")

print("\n✨ Script Complete.")