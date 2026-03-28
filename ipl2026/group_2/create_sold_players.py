import pandas as pd

# Read AuctionSummary - skip the title row
df = pd.read_csv('AuctionSummary.csv', skiprows=1)

# First row is the team names, remaining rows are players
teams_row = df.iloc[0]
players_df = df.iloc[1:].reset_index(drop=True)

records = []
for winner in df.columns:
    team = teams_row[winner]
    for player in players_df[winner]:
        if pd.notna(player) and str(player).strip():
            records.append({'Player': player.strip(), 'Team': team, 'Winner': winner})

sold_df = pd.DataFrame(records, columns=['Player', 'Team', 'Winner'])
sold_df.to_csv('sold_players.csv', index=False)
print(f'Created sold_players.csv with {len(sold_df)} players')

# Generate teams_sold.csv from the winner -> team mapping
teams_records = [{'Team': teams_row[winner], 'Winner': winner} for winner in df.columns]
teams_df = pd.DataFrame(teams_records, columns=['Team', 'Winner'])
teams_df.to_csv('teams_sold.csv', index=False)
print(f'Created teams_sold.csv with {len(teams_df)} teams')
