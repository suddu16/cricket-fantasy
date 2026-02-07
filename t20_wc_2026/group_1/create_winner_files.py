import pandas as pd
import os

# Read the sold players CSV
df = pd.read_csv('./sold_players.csv')

# Get unique winners
winners = df['Winner'].unique()

# Create output directory if it doesn't exist
output_dir = './winners'
os.makedirs(output_dir, exist_ok=True)

# Create individual CSV files for each winner
for winner in winners:
    winner_df = df[df['Winner'] == winner][['Player', 'Team']].copy()
    winner_df['Player'] = winner_df['Player'].str.lower()
    winner_df['Team'] = winner_df['Team'].str.lower()
    output_file = os.path.join(output_dir, f'{winner}.csv')
    winner_df.to_csv(output_file, index=False)
    print(f'Created {output_file} with {len(winner_df)} players')

print(f'\nTotal winners: {len(winners)}')

# Create results file with winners and initial score of 0.0
results_data = {'Winner': sorted(winners), 'Points': [0.0] * len(winners)}
results_df = pd.DataFrame(results_data)
results_file = 't20_wc_2026_results_day_0.csv'
results_df.to_csv(results_file, index=False, header=False)
print(f'\nCreated {results_file} with {len(winners)} winners')
