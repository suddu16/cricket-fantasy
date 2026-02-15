import pandas as pd
import sys
import os
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import time
import re
from datetime import date

# ==========================================
# 1. SETUP & PATHS
# ==========================================
USERNAME = "suddu16"
REPO = "cricket-fantasy"
group = sys.argv[1] if len(sys.argv) > 1 else 'group_1'

# Detect current day
ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = f'day_{day_num}'

# Fallback to latest file
if not os.path.exists(f'./data/mvp_{day}.csv'):
    files = sorted([f for f in os.listdir('./data/') if f.startswith('mvp_day_')], 
                   key=lambda x: int(x.split('_')[2].split('.')[0]), reverse=True)
    day = files[0].replace('mvp_', '').replace('.csv', '') if files else 'day_1'

ts = int(time.time())
print(f"🚀 Processing {day.upper()} for {group}...")

# ==========================================
# 2. LOAD & MAP DATA
# ==========================================
mvp_df = pd.read_csv(f'./data/mvp_{day}.csv')
mvp_df['Player'] = mvp_df['Player'].astype(str).str.lower().str.strip()

auction_file = f'./{group}/AuctionSummary.csv'
fantasy_teams_df = pd.read_csv(auction_file)
fantasy_mgrs = [c.strip() for c in fantasy_teams_df.columns]
fantasy_teams_df.columns = fantasy_mgrs

player_to_owner = {}
scores = {mgr: 0.0 for mgr in fantasy_mgrs}

for mgr in fantasy_mgrs:
    mgr_players = fantasy_teams_df[mgr].dropna().astype(str).str.lower().str.strip().tolist()
    for p in mgr_players: player_to_owner[p] = mgr.upper()
    mgr_pts = mvp_df[mvp_df['Player'].isin(mgr_players)]['Pts'].sum()
    scores[mgr] = round(mgr_pts, 2)

scores_df = pd.DataFrame(list(scores.items()), columns=['Manager', 'Pts']).sort_values(by='Pts', ascending=False)

# ==========================================
# 3. GENERATE ANIMATED PROGRESSION (MOVING GRAPH)
# ==========================================
print("🎬 Creating animated race...")
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(10, 5))

history_data = {mgr: [0] for mgr in fantasy_mgrs}
days_files = sorted([f for f in os.listdir('./data/') if f.startswith('mvp_day_')], 
                    key=lambda x: int(x.split('_')[2].split('.')[0]))

for d_file in days_files:
    temp_df = pd.read_csv(f'./data/{d_file}')
    temp_df['Player'] = temp_df['Player'].astype(str).str.lower().str.strip()
    for mgr in fantasy_mgrs:
        mgr_players = fantasy_teams_df[mgr].dropna().astype(str).str.lower().str.strip().tolist()
        pts = temp_df[temp_df['Player'].isin(mgr_players)]['Pts'].sum()
        history_data[mgr].append(pts)

lines = [ax.plot([], [], lw=3, marker='o', label=mgr)[0] for mgr in fantasy_mgrs]
ax.set_xlim(0, len(days_files))
ax.set_ylim(0, max([max(v) for v in history_data.values()]) * 1.1)
ax.set_title("📈 THE CHASE: LIVE PROGRESSION", fontsize=14, color='#00d4ff')
ax.legend(loc='center left', bbox_to_anchor=(1, 0.5))

def animate(i):
    for j, mgr in enumerate(fantasy_mgrs):
        lines[j].set_data(range(i+1), history_data[mgr][:i+1])
    return lines

ani = animation.FuncAnimation(fig, animate, frames=len(days_files)+1, interval=400, blit=True)
ani.save(f'./{group}/points_progression.gif', writer='pillow')
plt.close()

# ==========================================
# 4. GENERATE PIE CHART (TRANSPARENT)
# ==========================================
plt.figure(figsize=(6, 6))
plt.pie(scores_df['Pts'], labels=scores_df['Manager'], autopct='%1.1f%%', colors=plt.cm.Paired.colors)
plt.savefig(f'./{group}/manager_distribution.png', transparent=True)
plt.close()

# ==========================================
# 5. WEB INJECTION & GROUP 2 REMOVAL
# ==========================================
print("🏗️ Updating index.html UI...")

ui_html = f"""
<style>
    :root {{ --bg: #0b0e11; --card: #15191c; --text: #f0f0f0; --accent: #00d4ff; }}
    body.light-mode {{ --bg: #f8f9fa; --card: #ffffff; --text: #212529; --accent: #007bff; }}
    body {{ background: var(--bg) !important; color: var(--text) !important; transition: 0.3s ease; font-family: sans-serif; }}
    .f-container {{ background: var(--card); border: 1px solid #333; border-radius: 15px; padding: 20px; margin: 20px auto; max-width: 1000px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); text-align: center; }}
    #t-btn {{ position: fixed; bottom: 25px; right: 25px; z-index: 9999; background: var(--accent); color: white; border: none; border-radius: 50%; width: 55px; height: 55px; cursor: pointer; font-size: 22px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }}
</style>
<button id="t-btn" onclick="toggleT()">🌓</button>
<div class="f-container">
    <h2 style="color: var(--accent); letter-spacing: 1px;">🏆 TOURNAMENT DASHBOARD</h2>
    <img src="./{group}/points_progression.gif?v={ts}" style="width: 100%; border-radius: 10px;">
    <div style="display: flex; flex-wrap: wrap; justify-content: center; margin-top: 20px; gap: 20px;">
        <div style="flex: 1; min-width: 300px;">
            <h4 style="color: var(--accent)">Points Distribution</h4>
            <img src="./{group}/manager_distribution.png?v={ts}" style="width: 100%; max-width: 350px;">
        </div>
    </div>
</div>
<script>
    function toggleT() {{
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode')?'light':'dark');
    }}
    if(localStorage.getItem('theme')==='light') document.body.classList.add('light-mode');
</script>
"""

if os.path.exists('index.html'):
    with open('index.html', 'r') as f:
        content = f.read()
    
    # 1. Remove Group 2 Tabs/Content
    content = re.sub(r'<li.*?>.*?Group 2.*?</li>', '', content, flags=re.I)
    content = re.sub(r'<div.*?id="group_2".*?>.*?</div>', '', content, flags=re.I | re.S)
    
    # 2. Inject or Update Dashboard
    if "" in content:
        content = re.sub(r".*?", ui_html, content, flags=re.S)
    else:
        content = content.replace("<body>", "<body>" + ui_html)
        
    with open('index.html', 'w') as f:
        f.write(content)

print(f"✅ Success! Run 'git push' to see the moving graph and toggle on your site.")