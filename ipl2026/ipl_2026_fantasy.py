#!/usr/bin/env python
# coding: utf-8

# In[91]:


import pandas as pd
from pprint import pprint
from bs4 import BeautifulSoup
import io

pd.set_option('display.max_colwidth', 200)
pd.set_option('display.max_columns',None) #display all columns
pd.set_option('display.max_rows',None) #display all rows

groups_pts_src_map = {'group_1': 'cricketxi', 'group_2': 'iplt20'}
groups_team_wins_pts_map = {'group_1': 100, 'group_2': 50}
groups_team_nr_pts_map = {'group_1': 50, 'group_2': 25}
# Required Input files
# When running for the very first time, `ipl2025_results.csv`` file is required with all the team managers and an initial row of 0s.
# IPL2025MockAuctionSummary.csv file is required with each of the managers, their teams and their players listed.

# Dependencies to install
#  pip3 install beautifulsoup4
#  pip3 install lxml ??? (Double check if required)
#  pip3 install html5lib ??? (Double check if required)
#  pip3 install pywhatkit
#  pip3 install matplotlib
#  pip3 install selenium
#  pip3 install tabulate


# In[ ]:


import sys
from datetime import date

# Backup the input and output files for each day for posterity

# Change for each day
ipl_day_0 = date(2026, 3, 27)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
# Uncomment to set a specific day to get points for.
# day_num = 30
day = 'day_' + str(day_num)
prev_day = 'day_' + str(day_num - 1)
print(day_num)

# Change for each group
group = sys.argv[1]
group_pts_source = groups_pts_src_map[group]
group_team_win_pts = groups_team_wins_pts_map[group]
group_team_nr_pts = groups_team_nr_pts_map[group]
print(group)
print(group_pts_source)
tournament = 'ipl_2026'
results_file = f'./{group}/{tournament}_results_{day}.csv'
prev_results_file = f'./{group}/{tournament}_results_{prev_day}.csv'
leaderboard_graph_file = f'./{group}/{tournament}_leaderboard.png'
leaderboard_file = f'./{group}/{tournament}_leaderboard.txt'

ipl_mock_auction_summary = f'./{group}/AuctionSummary.csv'


# In[93]:


mvp_df = pd.read_csv(f'./data/{group_pts_source}/mvp_{day}.csv')
mvp_df


# In[94]:


# For group_2 (iplt20 source), recalculate Pts using our own scoring rules:
# 3.5 pts per wicket, 3.5 pts per six
# 2.5 pts per four, catch, or stumping
# 1 pt per dot ball
# 1 pt per run out (Run outs column stores iplt20 points at 3.5/run out, so divide by 3.5 to get count)
if group_pts_source == 'iplt20':
    mvp_df['Pts'] = (
        mvp_df['Wkts'] * 3.5 +
        mvp_df['6s'] * 3.5 +
        mvp_df['4s'] * 2.5 +
        mvp_df['Catches'] * 2.5 +
        mvp_df['Stumpings'] * 2.5 +
        mvp_df['Dots'] * 1 +
        (mvp_df['Run outs'] / 3.5) * 1
    )
mvp_df


# In[95]:


fantasy_teams_auction_df = pd.read_csv(ipl_mock_auction_summary)
fantasy_teams_auction_df


# In[96]:


fantasy_mgrs = fantasy_teams_auction_df.columns
fantasy_mgrs.to_list()


# In[97]:


#Make new dataframe for manager_teams 
fantasy_mgr_teams = fantasy_teams_auction_df.iloc[:1]
fantasy_mgr_teams


# In[98]:


import os
#Create new dataframe for manager_players
fantasy_teams_df = fantasy_teams_auction_df.iloc[1:]
fantasy_teams_df = fantasy_teams_df.apply(lambda x: x.astype(str).str.lower())

fantasy_teams_df_per_mgr = {}
for mgr in fantasy_teams_df.columns:
    mgr_file = f'./{group}/{mgr}.csv'
    if not os.path.exists(mgr_file):
        df = pd.DataFrame(fantasy_teams_df[mgr])
        df.to_csv(mgr_file, index=False)
    else:
        df = pd.read_csv(mgr_file)
    fantasy_teams_df_per_mgr[mgr] = df
fantasy_teams_df


# In[99]:


from thefuzz import fuzz
from thefuzz import process

# Compute total score for each fantasy team based on MVP points of each player
scores = { fantasy_mgr:0 for fantasy_mgr in fantasy_mgrs.to_list() }
for mgr in fantasy_mgrs:
    print(mgr)
    mgr_df = fantasy_teams_df_per_mgr[mgr]
    mgr_day_pts = {}
    mgr_file = f'./{group}/{mgr}.csv'
    all_players_have_min_pts = True
    mvp_players_with_pts = mvp_df['Player'].to_list()
    for i in range(len(fantasy_teams_df[mgr])):
        player_name = str(fantasy_teams_df[mgr].iloc[i]).lower()
        if player_name in mvp_players_with_pts:
            player_score = float(mvp_df.loc[mvp_df['Player'] == fantasy_teams_df[mgr].iloc[i],'Pts'].iloc[0])
            scores[mgr] += player_score
            mgr_day_pts[player_name] = player_score
            print(f'\t{player_name} points found. Adding his score {player_score} to total. New score {scores[mgr]}')
        else:
            closest_match = process.extractOne(player_name, mvp_players_with_pts)
            mgr_day_pts[player_name] = 0.0
            print(f'\t{player_name} not found in mvp_table... Double check the spelling of player name, closest match is {closest_match}')
            all_players_have_min_pts = False
    mgr_df[f'{day}'] = mgr_df.iloc[:, 0].map(mgr_day_pts)
    mgr_df = mgr_df.reindex(sorted(mgr_df.columns, key = lambda x: int(x.split("_")[1] if '_' in x else 0)), axis=1)
    mgr_df.to_csv(mgr_file, index=False)
    print(f'*{day.upper()}*\n```\n{mgr_df.to_markdown(index=False)}\n```')
    if all_players_have_min_pts:
        print(f'All players have min fantasy points.')


# In[100]:


scores


# In[101]:


ipl_team_pts_tbl = pd.read_csv(f'./data/standings_{day}.csv')
ipl_team_pts_tbl


# In[102]:


for mgr in fantasy_teams_df.columns:
    no_of_wins = 0
    no_of_nrs = 0
    if fantasy_mgr_teams[mgr].item() in ipl_team_pts_tbl.Teams.to_list():
        no_of_wins = ipl_team_pts_tbl.loc[ipl_team_pts_tbl['Teams'] == fantasy_mgr_teams[mgr].item(),'W'].item()
        if no_of_wins == '-':
            no_of_wins=0
        no_of_nrs = ipl_team_pts_tbl.loc[ipl_team_pts_tbl['Teams'] == fantasy_mgr_teams[mgr].item(),'N/R'].item()
        if no_of_nrs == '-':
            no_of_nrs=0
        scores[mgr] += (float(no_of_wins)*group_team_win_pts)
        scores[mgr] += (float(no_of_nrs)*group_team_nr_pts)
        print(f'{str(mgr)}\t{str(fantasy_mgr_teams[mgr].values)}\twins:{str(no_of_wins)}\tnr:{str(no_of_nrs)}')
scores


# In[103]:


prev_scores = pd.read_csv(prev_results_file, header=None)
prev_scores = prev_scores.T
new_header = prev_scores.iloc[0]
prev_scores = prev_scores[1:]
prev_scores.columns = new_header
prev_scores_dicts = prev_scores.to_dict(orient='records')
prev_scores_dicts


# In[104]:


current_scores_dict = prev_scores_dicts + [scores]


# In[105]:


graph_scores = pd.DataFrame(current_scores_dict)
graph_scores


# In[106]:


graph_scores_t = graph_scores.T
graph_scores_t = graph_scores_t.sort_values(by=graph_scores_t.columns[-1], ascending=False)
graph_scores_t.to_csv(results_file, header=False)
graph_scores_t


# In[107]:


import matplotlib.pyplot as plt
ax = graph_scores.plot.line(marker='o')
#ax.set_xlabel("Days")
ax.set_ylabel("Points")
# Create legend labels with final scores, sorted by points (descending)
final_scores = graph_scores.iloc[-1]
sorted_cols = final_scores.sort_values(ascending=False).index

# Calculate position changes (if there are at least 2 days of data)
position_changes = {}
if len(graph_scores) >= 2:
    prev_scores = graph_scores.iloc[-2]
    prev_sorted = prev_scores.sort_values(ascending=False).index

    # Create position mappings
    prev_positions = {col: idx for idx, col in enumerate(prev_sorted)}
    curr_positions = {col: idx for idx, col in enumerate(sorted_cols)}

    # Calculate changes (negative means moved up, positive means moved down)
    for col in sorted_cols:
        if col in prev_positions:
            position_changes[col] = prev_positions[col] - curr_positions[col]
        else:
            position_changes[col] = 0
else:
    # No previous data, all changes are 0
    for col in sorted_cols:
        position_changes[col] = 0

# Get handles and labels from the plot
handles, labels = ax.get_legend_handles_labels()
# Create a mapping of original column names to handles
handle_dict = dict(zip(graph_scores.columns, handles))
# Reorder handles and create new labels based on sorted columns with position change indicators
sorted_handles = [handle_dict[col] for col in sorted_cols]
sorted_labels = []
for col in sorted_cols:
    change = position_changes[col]
    if change > 0:
        # Upward triangle for improvement (will be colored green)
        indicator = f" ▲{change}"
    elif change < 0:
        # Downward triangle for decline (will be colored red)
        indicator = f" ▼{abs(change)}"
    else:
        indicator = ""
    sorted_labels.append(f"{col} ({int(final_scores[col])}){indicator}")

legend = plt.legend(sorted_handles, sorted_labels, bbox_to_anchor=(1.02, 1), loc='upper left', borderaxespad=0)

plt.savefig(leaderboard_graph_file, bbox_inches="tight")
plt.show()


# In[108]:


scores_sorted = {k: v for k, v in sorted(scores.items(), key=lambda item: item[1], reverse=True)}
score_msg = str(scores_sorted)

scores_msg_df = pd.DataFrame(
    scores_sorted.items(),
    columns=['Manager', 'Points']
)
leaderboard_table = f'*{day.upper()}*\n```\n{scores_msg_df.to_markdown(index=False)}\n```'
print()
with open(leaderboard_file, 'w') as f:
    f.write(leaderboard_table)

