const folders = ["data", "group_1", "group_2"];
const mainlineBranch = `https://raw.githubusercontent.com/suddu16/cricket-fantasy/main`;
const githubApiBase = `https://api.github.com/repos/suddu16/cricket-fantasy/contents`;
const tournament = `ipl2026`;
const resultsPrefix = `ipl_2026`;

// Store chart instances to destroy before recreating
let chartInstances = {};

// Cache for progression data to avoid re-fetching on every day change
const progressionCache = {};

// Populate just the MVP dropdown for a given source
async function populateMvpDropdown(mvpSource) {
    const select = document.getElementById('dataSelector');
    select.innerHTML = ''; // clear existing options
    const latestDay = await findLatestDay('data', 'mvp', mvpSource);
    for (let i = 1; i <= latestDay; i++) {
        const option = document.createElement("option");
        option.value = `${mainlineBranch}/${tournament}/data/${mvpSource}/mvp_day_${i}.csv`;
        option.textContent = `Day ${i}`;
        select.appendChild(option);
    }
    select.selectedIndex = latestDay - 1;
    loadCSV('data');
}

async function populateDropdowns() {
    // Fetch latest days for group folders in parallel
    const [g1Latest, g2Latest] = await Promise.all([
        findLatestDay('group_1', 'results'),
        findLatestDay('group_2', 'results'),
    ]);

    // Populate MVP dropdown with default source
    const defaultSource = document.querySelector('input[name="mvpSource"]:checked').value;
    await populateMvpDropdown(defaultSource);

    // Wire up source toggle
    document.querySelectorAll('input[name="mvpSource"]').forEach(radio => {
        radio.addEventListener('change', () => populateMvpDropdown(radio.value));
    });

    // Populate group dropdowns
    const groupLatest = { group_1: g1Latest, group_2: g2Latest };
    for (const folder of ["group_1", "group_2"]) {
        const select = document.getElementById(`${folder}Selector`);
        const latestDay = groupLatest[folder];
        for (let day = 1; day <= latestDay; day++) {
            const option = document.createElement("option");
            option.value = `${mainlineBranch}/${tournament}/${folder}/${resultsPrefix}_results_day_${day}.csv`;
            option.textContent = `Day ${day}`;
            select.appendChild(option);
        }
        const finalOption = document.createElement("option");
        finalOption.value = `${mainlineBranch}/${tournament}/${folder}/${resultsPrefix}_results_day_final.csv`;
        finalOption.textContent = `Final`;
        select.appendChild(finalOption);
        select.selectedIndex = latestDay - 1;
        // Don't eagerly load — wait for user to click the tab
    }
}

// Function to find the latest available day using GitHub Contents API (1 request instead of 31)
async function findLatestDay(folder, type, mvpSource) {
    try {
        let apiPath;
        if (type === 'mvp') {
            apiPath = `${githubApiBase}/${tournament}/data/${mvpSource}`;
        } else {
            apiPath = `${githubApiBase}/${tournament}/${folder}`;
        }
        const response = await fetch(apiPath);
        if (!response.ok) return 1;
        const files = await response.json();
        const pattern = type === 'mvp'
            ? /^mvp_day_(\d+)\.csv$/
            : new RegExp(`^${resultsPrefix}_results_day_(\\d+)\\.csv$`);
        let maxDay = 1;
        for (const file of files) {
            const match = file.name.match(pattern);
            if (match) {
                const day = parseInt(match[1]);
                if (day > maxDay) maxDay = day;
            }
        }
        return maxDay;
    } catch (error) {
        return 1;
    }
}

// Function to load CSV and check if it exists
async function loadCSV(folder) {
    let select, filename, messageDiv, tableDiv;

    // Set up player tabs
    if (folder === "group_1Players" || folder === "group_2Players") {
        const groupKey = folder.replace("Players", "");
        select = document.getElementById(`${folder}Selector`);
        filename = select.value;
        messageDiv = document.getElementById(`${groupKey}PlayerMessage`);
        tableDiv = document.getElementById(`${groupKey}PlayerTable`);
    } else {
        // Set up other tabs (data, group_1)
        select = document.getElementById(`${folder}Selector`);
        filename = select.value;
        messageDiv = document.getElementById(`${folder}Message`);
        tableDiv = document.getElementById(`${folder}Table`);
    }

    if (!messageDiv || !tableDiv) {
        console.error(`Error: Cannot find elements for ${folder} - messageDiv or tableDiv is null.`);
        return;
    }

    try {
        messageDiv.textContent = `Loading ${filename}...`;

        // Fetch the CSV data directly (HEAD requests are unreliable on raw.githubusercontent.com)
        const csvResponse = await fetch(filename);
        if (!csvResponse.ok) throw new Error("File not found");
        const csvText = await csvResponse.text();

        // Convert CSV text to a 2D array, filtering out empty rows
        const rows = csvText.split("\n")
            .map(row => row.split(","))
            .filter(row => row.length > 1); 

        // Clear previous table data
        tableDiv.innerHTML = "";

        // Create a table
        const table = document.createElement("table");
        table.classList.add("table", "table-striped"); // Add table styles
        table.id = `${folder}TableData`;  
        // Table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        if (rows.length === 0) throw new Error("Empty file or invalid format");

        // Process headers based on folder type
        if (folder === "data") {
            // MVP Data - render as-is
            rows[0].forEach(field => {
                const th = document.createElement("th");
                th.textContent = field;
                headerRow.appendChild(th);
            });
        } else if (folder === "group_1Players" || folder === "group_2Players") {
            const totalDays = rows[0].length - 1;
            headerRow.appendChild(createHeaderCell("Player")); // First column remains "Player"
            for (let day = totalDays; day >= 1; day--) {
                headerRow.appendChild(createHeaderCell(rows[0][day])); // Use actual day names from CSV
            }
        } else {
            // Other groups (group_1) - Display players as rows, days as columns (reversed)
            headerRow.appendChild(createHeaderCell("Player"));
            
            // The table body renders: row[0], then row[length-1] down to row[1]
            // So total columns = 1 (player name) + (row.length - 1) (all other values reversed)
            // Number of day columns = rows[0].length - 1
            const numDayColumns = rows[0].length - 1;
            
            // Add day headers in reverse order (most recent first)
            // If there are 3 day columns, show: Day 2, Day 1, Day 0
            for (let day = numDayColumns - 1; day >= 0; day--) {
                headerRow.appendChild(createHeaderCell(`Day ${day}`));
            }
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement("tbody");
        var startIndex = 1
        if (folder == "group_1" || folder == "group_2") {
            startIndex = 0
        }
        rows.slice(startIndex).forEach(row => {
            const tr = document.createElement("tr");

            if (folder === "data") {
                // Render MVP data as-is
                row.forEach(cell => {
                    tr.appendChild(createCell(cell));
                });
            } else if (folder === "group_1Players" || folder === "group_2Players") {
                tr.appendChild(createCell(row[0])); // Player name first
                
                // Build array of values in reverse order (most recent first)
                const values = [];
                for (let i = row.length - 1; i >= 1; i--) {
                    values.push(parseFloat(row[i]) || 0);
                }
                
                // Now iterate through values and compare with next day (which is previous chronologically)
                for (let i = 0; i < values.length; i++) {
                    const currentValue = values[i];
                    const cell = createCell(currentValue.toString());
                    
                    // For the last column (Day 1), highlight any non-zero value
                    if (i === values.length - 1) {
                        if (currentValue > 0) {
                            cell.classList.add("points-increased");
                            cell.style.backgroundColor = "#90EE90"; // Light green for positive
                            cell.style.fontWeight = "bold";
                        } else if (currentValue < 0) {
                            cell.classList.add("points-decreased");
                            cell.style.backgroundColor = "#FFB6C6"; // Light red/pink for negative
                            cell.style.fontWeight = "bold";
                        }
                    } else {
                        // Compare with the next value in array (previous day chronologically)
                        const previousDayValue = values[i + 1];
                        
                        if (currentValue !== previousDayValue) {
                            if (currentValue > previousDayValue) {
                                // Points increased
                                cell.classList.add("points-increased");
                                cell.style.backgroundColor = "#90EE90"; // Light green
                                cell.style.fontWeight = "bold";
                            } else if (currentValue < previousDayValue) {
                                // Points decreased
                                cell.classList.add("points-decreased");
                                cell.style.backgroundColor = "#FFB6C6"; // Light red/pink
                                cell.style.fontWeight = "bold";
                            }
                        }
                    }
                    
                    tr.appendChild(cell);
                }
            } else {
                // For group_1, reverse the order for days
                tr.appendChild(createCell(row[0])); // Player name first
                for (let i = row.length - 1; i > 0; i--) {
                    tr.appendChild(createCell(row[i]));
                }
            }

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);

        // Add total row for player groups showing daily points gained
        if (folder === "group_1Players" || folder === "group_2Players") {
            const tfoot = document.createElement("tfoot");
            const totalRow = document.createElement("tr");
            totalRow.style.fontWeight = "bold";
            totalRow.style.backgroundColor = "#f0f0f0";
            totalRow.style.borderTop = "2px solid #333";
            
            // First cell for label
            const labelCell = createCell("Daily Points");
            totalRow.appendChild(labelCell);
            
            // Calculate daily points for each day column
            // rows[0] is the header with day names
            // rows[1+] are player rows with cumulative points
            
            const numDays = rows[0].length - 1; // Exclude player name column
            
            // For each day column (in reverse order as displayed)
            for (let dayIndex = numDays; dayIndex >= 1; dayIndex--) {
                let dailyTotal = 0;
                
                // Sum up the daily points for all players for this day
                for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                    const currentPoints = parseFloat(rows[rowIndex][dayIndex]) || 0;
                    const prevPoints = parseFloat(rows[rowIndex][dayIndex - 1]) || 0;
                    dailyTotal += (currentPoints - prevPoints);
                }
                
                const totalCell = createCell(dailyTotal.toFixed(1));
                totalCell.style.backgroundColor = "#e0e0e0";
                totalRow.appendChild(totalCell);
            }
            
            tfoot.appendChild(totalRow);
            table.appendChild(tfoot);
        }

        tableDiv.appendChild(table);

        // Clear message after successful load
        messageDiv.textContent = "";

        // Create chart for group_1 or group_2 if applicable
        if (folder === "group_1" || folder === "group_2") {
            await createProgressionChart(folder, rows);
            await displayDailyPointsAndTopScorer(folder, rows);
        }

        // Initialize DataTable functionality
        const tableId = table.id;

        if (tableId.includes("dataTableData")) {
            // For MVP data
            $(table).DataTable({
                searching: true,  
                ordering: true, 
                pageLength: 20,
                info: true,
                order: [[1, "desc"]] 
            });
        } else {
            // For group_1, sort by the last column
            $(table).DataTable({
                searching: true,  
                pageLength: 20,
                ordering: true,   
                info: true,       
                order: [[1, "desc"]] 
            });
        }

    } catch (error) {
        messageDiv.textContent = `Failed to load data: ${error.message}`;
        console.error('loadCSV error:', error);
    }
}

// Helper function to create table header cells
function createHeaderCell(text) {
    const th = document.createElement("th");
    th.textContent = text;
    return th;
}

// Helper function to create table data cells
function createCell(text) {
    const td = document.createElement("td");
    td.textContent = text || "-"; // Handle empty values
    return td;
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
    await populateDropdowns();

    // Load group data on demand when tab is clicked
    const loadedTabs = {};
    ['group_1', 'group_2'].forEach(folder => {
        const tabEl = document.querySelector(`[href="#${folder}"]`);
        if (tabEl) {
            tabEl.addEventListener('shown.bs.tab', () => {
                if (!loadedTabs[folder]) {
                    loadedTabs[folder] = true;
                    loadCSV(folder);
                }
            });
        }
    });

    // Get the URL parameters
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const dropdownParam = params.get("dropdown");

    if (tabParam) {
        const tabElement = document.querySelector(`[href="#${tabParam}"]`);
        if (tabElement) {
            const tab = new bootstrap.Tab(tabElement);
            tab.show();
            if (tabParam === 'group_1' || tabParam === 'group_2') {
                loadedTabs[tabParam] = true;
                loadCSV(tabParam);
            }
        }
    }

    if (dropdownParam) {
        const dropdowns = document.querySelectorAll("select");
        dropdowns.forEach(select => {
            const option = select.querySelector(`option[value*="${dropdownParam}"]`);
            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event("change"));
            }
        });
    }
});


// Function to create progression chart for Group 1
async function createProgressionChart(folder, currentDayData) {
    const canvasId = `${folder}Chart`;
    const canvas = document.getElementById(canvasId);
    
    if (!canvas) return;

    // Destroy existing chart if it exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Build allDaysData directly from currentDayData columns — zero extra fetches.
    // Each row is [playerName, day0pts, day1pts, ..., dayNpts]
    const hasHeader = isNaN(parseFloat(currentDayData[0][currentDayData[0].length - 1]));
    const dataRows = hasHeader ? currentDayData.slice(1) : currentDayData;
    const numDays = dataRows[0].length - 1; // number of day columns

    const allDaysData = [];
    for (let col = 1; col <= numDays; col++) {
        const day = col - 1;
        const rows = dataRows.map(row => [row[0], row[col]]);
        allDaysData.push({ day, rows });
    }

    if (allDaysData.length === 0) return;

    const playerNames = dataRows.map(row => row[0]);
    const colors = generateColors(playerNames.length);

    const datasets = playerNames.map((playerName, index) => {
        const data = allDaysData.map(dayData => {
            const playerRow = dayData.rows.find(row => row[0] === playerName);
            return playerRow ? (parseFloat(playerRow[1]) || 0) : 0;
        });
        return {
            label: playerName,
            data: data,
            borderColor: colors[index],
            backgroundColor: colors[index] + '33',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6
        };
    });

    const labels = allDaysData.map(d => `Day ${d.day}`);

    // Create the chart
    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Points Progression Over Time',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        beforeBody: function(tooltipItems) {
                            // Sort players by points (descending)
                            const sorted = tooltipItems.sort((a, b) => b.parsed.y - a.parsed.y);
                            return '';
                        },
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const dayIndex = context.dataIndex;
                            const playerName = context.dataset.label;
                            const points = context.parsed.y;
                            
                            // Calculate current position
                            const allPlayersAtDay = context.chart.data.datasets.map((ds, idx) => ({
                                name: ds.label,
                                points: ds.data[dayIndex],
                                index: idx
                            })).sort((a, b) => b.points - a.points);
                            
                            const currentPosition = allPlayersAtDay.findIndex(p => p.name === playerName) + 1;
                            
                            // Calculate position change
                            let positionChange = '';
                            let arrow = '';
                            if (dayIndex > 0) {
                                const allPlayersAtPrevDay = context.chart.data.datasets.map((ds, idx) => ({
                                    name: ds.label,
                                    points: ds.data[dayIndex - 1],
                                    index: idx
                                })).sort((a, b) => b.points - a.points);
                                
                                const prevPosition = allPlayersAtPrevDay.findIndex(p => p.name === playerName) + 1;
                                const change = prevPosition - currentPosition;
                                
                                if (change > 0) {
                                    arrow = '▲';
                                    positionChange = ` ${arrow}${change}`;
                                } else if (change < 0) {
                                    arrow = '▼';
                                    positionChange = ` ${arrow}${Math.abs(change)}`;
                                } else {
                                    arrow = '━';
                                    positionChange = ` ${arrow}`;
                                }
                            }
                            
                            return `#${currentPosition} ${playerName}: ${points} pts${positionChange}`;
                        },
                        labelTextColor: function(context) {
                            return context.dataset.borderColor;
                        }
                    },
                    itemSort: function(a, b) {
                        // Sort tooltip items by points (descending)
                        return b.parsed.y - a.parsed.y;
                    }
                },
                annotation: {
                    annotations: {}
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Points'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Day'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    // Create rankings display
    const chart = chartInstances[canvasId];
    const lastDataIndex = labels.length - 1;
    
    // Create a color map for all players
    const playerColorMap = {};
    datasets.forEach((dataset, idx) => {
        playerColorMap[dataset.label] = dataset.borderColor;
    });
    
    updateRankingsDisplay(folder, allDaysData, lastDataIndex, playerColorMap);
    
    // Update rankings display on hover
    canvas.addEventListener('mousemove', (event) => {
        const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
        if (points.length > 0) {
            const dayIndex = points[0].index;
            updateRankingsDisplay(folder, allDaysData, dayIndex, playerColorMap);
        }
    });
    
    // Restore latest day rankings when mouse leaves
    canvas.addEventListener('mouseleave', () => {
        updateRankingsDisplay(folder, allDaysData, lastDataIndex, playerColorMap);
    });
}

// Function to update the rankings display
function updateRankingsDisplay(folder, allDaysData, dayIndex, playerColorMap) {
    const rankingsList = document.getElementById(`${folder}RankingsList`);
    if (!rankingsList) return;
    
    const dayData = allDaysData[dayIndex];
    const day = dayData.day;
    
    // rows are [playerName, points] — no header
    const players = dayData.rows.map(row => ({
        name: row[0],
        points: parseFloat(row[1]) || 0
    }));
    
    // Sort by points descending
    players.sort((a, b) => b.points - a.points);
    
    // Calculate position changes if not day 0
    let positionChanges = {};
    if (dayIndex > 0) {
        const prevDayData = allDaysData[dayIndex - 1];
        const prevPlayers = prevDayData.rows.map(row => ({
            name: row[0],
            points: parseFloat(row[1]) || 0
        }));
        prevPlayers.sort((a, b) => b.points - a.points);
        
        const prevPositions = {};
        prevPlayers.forEach((p, idx) => prevPositions[p.name] = idx + 1);
        
        players.forEach((p, idx) => {
            const currentPos = idx + 1;
            const prevPos = prevPositions[p.name] || currentPos;
            const change = prevPos - currentPos;
            positionChanges[p.name] = change;
        });
    }
    
    // Build HTML
    let html = `<div class="mb-2 text-center"><strong>Day ${day}</strong></div>`;
    
    players.forEach((player, idx) => {
        const position = idx + 1;
        const change = positionChanges[player.name] || 0;
        let arrow = '';
        let changeClass = '';
        
        if (change > 0) {
            arrow = `<span class="text-success">▲${change}</span>`;
            changeClass = 'border-success';
        } else if (change < 0) {
            arrow = `<span class="text-danger">▼${Math.abs(change)}</span>`;
            changeClass = 'border-danger';
        } else if (dayIndex > 0) {
            arrow = `<span class="text-secondary">━</span>`;
        }
        
        // Find player color from the map
        const playerColor = playerColorMap[player.name] || '#999';
        
        html += `
            <div class="d-flex align-items-center mb-2 p-2 border-start border-3 ${changeClass}" style="border-left-color: ${playerColor} !important; font-size: 0.9rem;">
                <div class="me-2" style="min-width: 25px;"><strong>#${position}</strong></div>
                <div class="flex-grow-1">${player.name}</div>
                <div class="me-2"><strong>${player.points}</strong> pts</div>
                <div style="min-width: 30px; text-align: center;">${arrow}</div>
            </div>
        `;
    });
    
    rankingsList.innerHTML = html;
}
// Helper function to generate distinct colors for players
function generateColors(count) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
        '#36A2EB', '#FFCE56', '#8B4513', '#2E8B57', '#DC143C'
    ];
    
    // If we need more colors than predefined, generate random ones
    while (colors.length < count) {
        colors.push('#' + Math.floor(Math.random()*16777215).toString(16));
    }
    
    return colors.slice(0, count);
}



// Function to display daily points and top scorer
async function displayDailyPointsAndTopScorer(folder, currentDayData) {
    const select = document.getElementById(`${folder}Selector`);
    const selectedOption = select.options[select.selectedIndex].text;
    
    // Handle "Final" option
    if (selectedOption === 'Final') {
        return; // Skip for final day
    }
    
    const currentDay = parseInt(selectedOption.replace('Day ', ''));
    
    // Skip Day 0 as there's no previous day
    if (currentDay === 0) {
        return;
    }
    
    try {
        // Data structure after table processing:
        // Each row is a PLAYER
        // currentDayData[0] = [playerName, day0Points, day1Points, day2Points, ...]
        // currentDayData[1] = [playerName, day0Points, day1Points, day2Points, ...]
        
        console.log('=== DEBUG: displayDailyPointsAndTopScorer ===');
        console.log('Current Day:', currentDay);
        console.log('Full currentDayData:', currentDayData);
        
        // Calculate daily points for each player
        const dailyPoints = [];
        
        // For tracking best single day performance across all days
        let bestSingleDayPoints = -Infinity;
        let bestSingleDayPlayer = [];
        let bestSingleDayNumber = 0;
        let bestSingleDayStartDay = 0; // When this record started
        
        // For tracking who has been #1 the most
        const daysAtRank1 = {}; // playerName -> count of days at #1
        
        // Column index for current day (column 0 is player name, column 1 is day 0, column 2 is day 1, etc.)
        const currentDayColIndex = currentDay + 1;
        const prevDayColIndex = currentDay; // Previous day column
        
        console.log('Current Day Column Index:', currentDayColIndex);
        console.log('Previous Day Column Index:', prevDayColIndex);
        
        // First pass: Calculate who was #1 on each day
        for (let dayCol = 1; dayCol <= currentDayColIndex; dayCol++) {
            let maxPointsForDay = -Infinity;
            let leadersForDay = [];
            
            // Find the leader(s) for this day
            for (let row = 0; row < currentDayData.length; row++) {
                const playerRow = currentDayData[row];
                if (playerRow.length <= dayCol) continue;
                
                const playerName = playerRow[0];
                const points = parseFloat(playerRow[dayCol]) || 0;
                
                if (points > maxPointsForDay) {
                    maxPointsForDay = points;
                    leadersForDay = [playerName];
                } else if (points === maxPointsForDay && points > 0) {
                    leadersForDay.push(playerName);
                }
            }
            
            // Only count days where someone actually has points (skip Day 0 if everyone is at 0)
            if (maxPointsForDay > 0) {
                console.log(`Day ${dayCol - 1}: Leader(s) = ${leadersForDay.join(', ')} with ${maxPointsForDay} points`);
                // Increment count for leader(s) of this day
                leadersForDay.forEach(leader => {
                    daysAtRank1[leader] = (daysAtRank1[leader] || 0) + 1;
                });
            }
        }
        
        // Find who has been #1 the most
        let mostDaysAtRank1 = 0;
        let mostDaysLeader = [];
        for (const [player, days] of Object.entries(daysAtRank1)) {
            if (days > mostDaysAtRank1) {
                mostDaysAtRank1 = days;
                mostDaysLeader = [player];
            } else if (days === mostDaysAtRank1) {
                mostDaysLeader.push(player);
            }
        }
        
        // Calculate position changes between current day and previous day
        let maxPositionGain = 0;
        let biggestClimber = [];
        
        // Get rankings for current day
        const currentDayRankings = [];
        for (let row = 0; row < currentDayData.length; row++) {
            const playerRow = currentDayData[row];
            if (playerRow.length <= currentDayColIndex) continue;
            
            const playerName = playerRow[0];
            const points = parseFloat(playerRow[currentDayColIndex]) || 0;
            currentDayRankings.push({ name: playerName, points: points });
        }
        currentDayRankings.sort((a, b) => b.points - a.points);
        
        // Get rankings for previous day
        const prevDayRankings = [];
        for (let row = 0; row < currentDayData.length; row++) {
            const playerRow = currentDayData[row];
            if (playerRow.length <= prevDayColIndex) continue;
            
            const playerName = playerRow[0];
            const points = parseFloat(playerRow[prevDayColIndex]) || 0;
            prevDayRankings.push({ name: playerName, points: points });
        }
        prevDayRankings.sort((a, b) => b.points - a.points);
        
        // Calculate position changes
        for (let i = 0; i < currentDayRankings.length; i++) {
            const playerName = currentDayRankings[i].name;
            const currentPos = i + 1;
            const prevPos = prevDayRankings.findIndex(p => p.name === playerName) + 1;
            const positionGain = prevPos - currentPos; // Positive means moved up
            
            if (positionGain > maxPositionGain) {
                maxPositionGain = positionGain;
                biggestClimber = [playerName];
            } else if (positionGain === maxPositionGain && positionGain > 0) {
                biggestClimber.push(playerName);
            }
        }
        
        console.log('Biggest Climber:', biggestClimber, 'gained', maxPositionGain, 'positions');
        
        // Iterate through each player (each row)
        for (let row = 0; row < currentDayData.length; row++) {
            const playerRow = currentDayData[row];
            
            // Check if row has enough columns
            if (playerRow.length <= currentDayColIndex) {
                console.log(`Row ${row} doesn't have enough columns`);
                continue;
            }
            
            const playerName = playerRow[0]; // First column is player name
            const currentPoints = parseFloat(playerRow[currentDayColIndex]) || 0;
            const prevPoints = parseFloat(playerRow[prevDayColIndex]) || 0;
            const points = currentPoints - prevPoints;
            
            console.log(`Player: ${playerName}, Current: ${currentPoints}, Prev: ${prevPoints}, Daily: ${points}`);
            
            dailyPoints.push({
                name: playerName,
                points: points
            });
            
            // Check all days for this player to find their best single day
            for (let dayCol = 1; dayCol <= currentDayColIndex; dayCol++) {
                const dayPoints = parseFloat(playerRow[dayCol]) || 0;
                const prevDayPoints = parseFloat(playerRow[dayCol - 1]) || 0;
                const dailyScore = dayPoints - prevDayPoints;
                
                if (dailyScore > bestSingleDayPoints) {
                    bestSingleDayPoints = dailyScore;
                    bestSingleDayPlayer = [playerName];
                    bestSingleDayNumber = dayCol - 1; // dayCol 1 = day 0, dayCol 2 = day 1, etc.
                    bestSingleDayStartDay = dayCol - 1; // Record when this started
                } else if (dailyScore === bestSingleDayPoints && dailyScore > 0) {
                    if (!bestSingleDayPlayer.includes(playerName)) {
                        bestSingleDayPlayer.push(playerName);
                    }
                }
            }
        }
        
        // Calculate how long the record has stood
        const daysHeld = currentDay - bestSingleDayStartDay;
        
        console.log('Daily Points:', dailyPoints);
        console.log('Best Single Day:', bestSingleDayPlayer, 'with', bestSingleDayPoints, 'points on Day', bestSingleDayNumber, '- held for', daysHeld, 'days');
        console.log('Most Days at #1:', mostDaysLeader, 'with', mostDaysAtRank1, 'days');
        
        // Sort by points descending
        dailyPoints.sort((a, b) => b.points - a.points);
        
        // Create the display section
        const tableDiv = document.getElementById(`${folder}Table`);
        
        // Remove existing stats if present FIRST
        const existingStats = document.getElementById(`${folder}DailyStats`);
        if (existingStats) {
            existingStats.remove();
        }
        
        // Create container for daily stats
        const statsContainer = document.createElement('div');
        statsContainer.className = 'mt-4 mb-4';
        statsContainer.id = `${folder}DailyStats`;
        
        // First row with 3 stat cards
        const firstRow = document.createElement('div');
        firstRow.className = 'row mb-3';
        
        // Most days at #1 card
        const mostDaysCard = document.createElement('div');
        mostDaysCard.className = 'col-lg-4 col-md-6 mb-3 mb-lg-0';
        
        let daysText = mostDaysAtRank1 === 1 ? '1 day' : `${mostDaysAtRank1} days`;
        
        mostDaysCard.innerHTML = `
            <div class="card border-primary h-100">
                <div class="card-header bg-primary text-white">
                    <strong>👑 Most Days at #1</strong>
                    <span class="badge bg-light text-primary float-end">JENDA</span>
                </div>
                <div class="card-body text-center">
                    <h3 class="text-primary">${mostDaysLeader.join(', ')}</h3>
                    <h4>${daysText}</h4>
                </div>
            </div>
        `;
        
        // Biggest climber card
        const biggestClimberCard = document.createElement('div');
        biggestClimberCard.className = 'col-lg-4 col-md-6 mb-3 mb-lg-0';
        
        let positionText = maxPositionGain === 1 ? '1 position' : `${maxPositionGain} positions`;
        
        biggestClimberCard.innerHTML = `
            <div class="card border-success h-100">
                <div class="card-header bg-success text-white">
                    <strong>📈 Biggest Climber</strong>
                    <span class="badge bg-light text-success float-end">JENDA</span>
                </div>
                <div class="card-body text-center">
                    <h3 class="text-success">${biggestClimber.join(', ')}</h3>
                    <h4>+${positionText}</h4>
                    <p class="mb-0 text-muted">on Day ${currentDay}</p>
                </div>
            </div>
        `;
        
        // Best single day performance card
        const topScorerCard = document.createElement('div');
        topScorerCard.className = 'col-lg-4 col-md-12 mb-3 mb-lg-0';
        
        // Format the duration text
        let durationText = '';
        if (daysHeld === 0) {
            durationText = '<span class="badge bg-success">New Record!</span>';
        } else if (daysHeld === 1) {
            durationText = `<span class="badge bg-info">Held for 1 day</span>`;
        } else {
            durationText = `<span class="badge bg-info">Held for ${daysHeld} days</span>`;
        }
        
        topScorerCard.innerHTML = `
            <div class="card border-warning h-100">
                <div class="card-header bg-warning text-dark">
                    <strong>🏆 Best Single Day Performance</strong>
                    <span class="badge bg-light text-dark float-end">JENDA</span>
                </div>
                <div class="card-body text-center">
                    <h3 class="text-warning">${bestSingleDayPlayer.join(', ')}</h3>
                    <h4>${bestSingleDayPoints.toFixed(1)} points</h4>
                    <p class="mb-2 text-muted">on Day ${bestSingleDayNumber}</p>
                    <p class="mb-0">${durationText}</p>
                </div>
            </div>
        `;
        
        // Add cards to first row
        firstRow.appendChild(mostDaysCard);
        firstRow.appendChild(biggestClimberCard);
        firstRow.appendChild(topScorerCard);
        
        // Second row with daily points table (full width)
        const secondRow = document.createElement('div');
        secondRow.className = 'row';
        
        // Daily points table card
        const dailyPointsCard = document.createElement('div');
        dailyPointsCard.className = 'col-12';
        
        let dailyPointsHTML = `
            <div class="card">
                <div class="card-header bg-info text-white">
                    <strong>📊 Points Scored on Day ${currentDay}</strong>
                    <span class="badge bg-light text-info float-end">JENDA</span>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th>Points</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        dailyPoints.forEach((player, idx) => {
            const rowClass = idx === 0 ? 'table-warning' : '';
            dailyPointsHTML += `
                <tr class="${rowClass}">
                    <td><strong>${idx + 1}</strong></td>
                    <td>${player.name}</td>
                    <td><strong>${player.points.toFixed(1)}</strong></td>
                </tr>
            `;
        });
        
        dailyPointsHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        dailyPointsCard.innerHTML = dailyPointsHTML;
        
        // Add daily points card to second row
        secondRow.appendChild(dailyPointsCard);
        
        // Add both rows to container
        statsContainer.appendChild(firstRow);
        statsContainer.appendChild(secondRow);
        
        // Insert before the table
        tableDiv.parentNode.insertBefore(statsContainer, tableDiv);
        
    } catch (error) {
        console.error('Error calculating daily points:', error);
    }
}
