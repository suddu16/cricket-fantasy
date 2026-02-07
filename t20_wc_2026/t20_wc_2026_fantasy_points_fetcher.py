#!/usr/bin/env python
# coding: utf-8

# In[4]:


import pandas as pd
from pprint import pprint
from bs4 import BeautifulSoup
import io

pd.set_option('display.max_colwidth', 200)
pd.set_option('display.max_columns',None) #display all columns
pd.set_option('display.max_rows',None) #display all rows

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
#  pip3 install thefuzz


# In[1]:


from datetime import date

# Change for each day
ipl_day_0 = date(2026, 2, 6)
ipl_day_cur = date.today()
day_num = abs((ipl_day_cur - ipl_day_0).days)
day = 'day_' + str(day_num)
prev_day = 'day_' + str(day_num - 1)
print(day_num)


# In[ ]:


from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException

user_agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.50 Safari/537.36'
chrome_options = Options()
chrome_options.add_argument('user-agent={0}'.format(user_agent))
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=chrome_options)

url = 'https://cricketxi.com/t20-world-cup-2026/players/'
driver.get(url)


# Keep clicking the awardsStats button until it's no longer found
import time

while True:
    try:
        button = driver.find_element(By.CLASS_NAME, "loading")
        button.click()
        print("Clicked loading button")
        # Optional: add a small delay to avoid overwhelming the server
        time.sleep(0.5)
    except NoSuchElementException:
        print("loading button no longer found - continuing...")
        break

html = driver.page_source

driver.quit()


# In[5]:


tables = pd.read_html(io.StringIO(html))
tables[0].columns
mvp_df = [table for table in tables if 'Points  Points  Arrow up  Arrow down  Total Points' in table][0]

mvp_df[['Player', 'Player Short Name']] = mvp_df['Player'].str.rsplit('  ', n=1, expand=True)
mvp_df[['Team long name', 'Team']] = mvp_df['Team'].str.rsplit('  ', n=1, expand=True)
mvp_df[['Position long name', 'Position']] = mvp_df['Position'].str.rsplit('  ', n=1, expand=True)

# mvp_df['Player'] = mvp_df['Player'].str.replace('\\s+', ' ', regex=True)
mvp_df['Player'] = mvp_df['Player'].str.lower()
mvp_df['Team'] = mvp_df['Team'].str.lower()
mvp_df['Position'] = mvp_df['Position'].str.lower()
mvp_df['Player Short Name'] = mvp_df['Player Short Name'].str.lower()

mvp_df = mvp_df.rename(columns={"Points  Points  Arrow up  Arrow down  Total Points": "Pts"})
mvp_df = mvp_df[['Player', 'Player Short Name', 'Team', 'Position', 'Pts']]

mvp_df.to_csv(f'./data/mvp_{day}.csv', index=False)

mvp_df


