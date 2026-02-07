import pandas as pd
import os

# Read the sold players CSV
df = pd.read_csv('sold_players.csv')

# Get unique winners
winners = sorted(df['Winner'].unique())

# Create a dictionary to store players for each winner
summary_data = {}

for winner in winners:
    winner_players = df[df['Winner'] == winner]['Player'].str.lower().tolist()
    summary_data[winner] = winner_players

# Create DataFrame with equal length columns (pad with empty strings)
max_length = max(len(players) for players in summary_data.values())
for winner in summary_data:
    while len(summary_data[winner]) < max_length:
        summary_data[winner].append('')

summary_df = pd.DataFrame(summary_data)

# Save to CSV
output_file = 'AuctionSummary.csv'
summary_df.to_csv(output_file, index=False)
print(f'Created {output_file}')
print(f'Winners: {len(winners)}')
print(f'Max players per winner: {max_length}')
