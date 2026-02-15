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

# Group Argument
if len(sys.argv) > 1:
    group = sys.argv[1]
else:
    group = 'group_1' # Default if forgot to type it

print(f"📂 Working on Group: {group}")

# Date Logic
ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = 'day_' + str(day_num)
prev_day = 'day_' + str(day_num - 1)

# --- AUTO-FIX: Fallback if today's data is missing ---
if not os.path.exists(f'./data/mvp_{day}.csv'):
    print(f"⚠️  Data for {day} not found. Falling back to 'day_1' for demo.")
    day = 'day_1'
    prev_day = 'day_0'
# -----------------------------------------------------

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
# Load MVP Points
try:
    mvp_df = pd.read_csv(f'./data/mvp_{day}.csv')
except FileNotFoundError:
    print(f"❌ Error: Could not find ./data/mvp_{day}.csv. Make sure data exists.")
    sys.exit(1)

# Load Teams
fantasy_teams_auction_df = pd.read_csv(ipl_mock_auction_summary)
fantasy_mgrs = fantasy_teams_auction_df.columns.to_list()

# Standardize Strings
fantasy_teams_df = fantasy_teams_auction_df.apply(lambda x: x.astype(str).str.lower())

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
        player_name = str(fantasy_teams_df[mgr].iloc[i]).lower()
        
        if player_name in mvp_players_with_pts:
            # Exact Match
            player_score = float(mvp_df.loc[mvp_df['Player'] == fantasy_teams_df[mgr].iloc[i],'Pts'].iloc[0])
            scores[mgr] += player_score
            mgr_day_pts[player_name] = player_score
        else:
            # Fuzzy Match
            closest_match = process.extractOne(player_name, mvp_players_with_pts)
            mgr_day_pts[player_name] = 0.0
            
    # Update Manager File
    mgr_df[f'{day}'] = mgr_df.iloc[:, 0].map(mgr_day_pts)
    mgr_df = mgr_df.reindex(sorted(mgr_df.columns, key = lambda x: int(x.split("_")[1] if '_' in x else 0)), axis=1)
    mgr_df.to_csv(mgr_file, index=False)

# ==========================================
# 4. 🚀 INSTANT LEADERBOARD (OPTIMIZED)
# ==========================================
print("\n" + "="*40)
print(f" 🏆 MANAGER STANDINGS ({day}) 🏆")
print("="*40)

# Sort scores High -> Low
scores_sorted = {k: v for k, v in sorted(scores.items(), key=lambda item: item[1], reverse=True)}

# Create Table
scores_msg_df = pd.DataFrame(scores_sorted.items(), columns=['Manager', 'Points'])

# Print to Console IMMEDIATELY
print(scores_msg_df.to_markdown(index=False))

# Save Text File
leaderboard_table = f'*{day.upper()}*\n```\n{scores_msg_df.to_markdown(index=False)}\n```'
with open(leaderboard_file, 'w') as f:
    f.write(leaderboard_table)

print("\n... Generating graphs in background ...")

# ==========================================
# 5. HISTORICAL TRACKING & LINE GRAPH
# ==========================================
# Load Previous Results
if os.path.exists(prev_results_file):
    prev_scores = pd.read_csv(prev_results_file, header=None).T
    new_header = prev_scores.iloc[0]
    prev_scores = prev_scores[1:]
    prev_scores.columns = new_header
    prev_scores_dicts = prev_scores.to_dict(orient='records')
else:
    prev_scores_dicts = []

# Append Current Scores
current_scores_dict = prev_scores_dicts + [scores]
graph_scores = pd.DataFrame(current_scores_dict)

# Save New Results File
graph_scores_t = graph_scores.T
graph_scores_t = graph_scores_t.sort_values(by=graph_scores_t.columns[-1], ascending=False)
graph_scores_t.to_csv(results_file, header=False)

# Generate Line Graph
ax = graph_scores.plot.line(marker='o')
ax.set_ylabel("Points")

# Legend Logic
final_scores = graph_scores.iloc[-1]
sorted_cols = final_scores.sort_values(ascending=False).index

position_changes = {}
if len(graph_scores) >= 2:
    prev_s = graph_scores.iloc[-2]
    prev_sorted = prev_s.sort_values(ascending=False).index
    prev_positions = {col: idx for idx, col in enumerate(prev_sorted)}
    curr_positions = {col: idx for idx, col in enumerate(sorted_cols)}
    for col in sorted_cols:
        if col in prev_positions:
            position_changes[col] = prev_positions[col] - curr_positions[col]
        else:
            position_changes[col] = 0
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
# plt.show()  <-- DISABLED BLOCKING POPUP

# ==========================================
# 6. FEATURE: TOP 10 PLAYERS GRAPH
# ==========================================
print("📊 Generating 'leaderboard.png' (Top 10 Players)...")

try:
    if 'mvp_df' in locals():
        # Sort by Pts
        top_10 = mvp_df.sort_values(by='Pts', ascending=False).head(10)
        
        # Create Bar Chart
        plt.figure(figsize=(10, 6)) 
        plt.bar(top_10['Player'], top_10['Pts'], color='skyblue')
        
        plt.title(f'Top 10 MVP Players ({day})')
        plt.xlabel('Player Name')
        plt.ylabel('Total Points')
        plt.xticks(rotation=45, ha='right') 
        plt.tight_layout()
        
        plt.savefig('leaderboard.png')
        print("✅ Success! Open 'leaderboard.png' to see the Top 10 graph.")
    else:
        print("❌ Error: mvp_df not found.")

except Exception as e:
    print(f"❌ Graph Error: {e}")

print("\n✨ Script Complete.")