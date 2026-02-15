const folders = ["data", "group_1"];
const maxDays = 31;
const mainlineBranch = `https://raw.githubusercontent.com/suddu16/cricket-fantasy/main`;
const tournament = `t20_wc_2026`

// Store chart instances to destroy before recreating
let chartInstances = {};

// Function to populate dropdowns for each tab
async function populateDropdowns() {
    for (const folder of folders) {
        const select = document.getElementById(`${folder}Selector`);
        let latestDay = 1;
        
        if (folder === 'data') {
            for (let i = 1; i <= maxDays; i++) { 
                const filename = `${mainlineBranch}/${tournament}/data/mvp_day_${i}.csv`;

                const option = document.createElement("option");
                option.value = filename;
                option.textContent = `Day ${i}`;
                select.appendChild(option);
            }
            
            // Find the latest available day for MVP data
            latestDay = await findLatestDay(folder, 'mvp');
            if (latestDay > 0) {
                select.selectedIndex = latestDay - 1; // Set to latest day (0-indexed)
                loadCSV('data'); // Load the data for the selected day
            }
        } else {
            for (let day = 1; day <= maxDays; day++) {
                const option = document.createElement("option");
                option.value = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_${day}.csv`;
                option.textContent = `Day ${day}`;
                select.appendChild(option);
            }
            const option = document.createElement("option");
            option.value = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_final.csv`;
            option.textContent = `Final`;
            select.appendChild(option);
            
            // Find the latest available day for group data
            latestDay = await findLatestDay(folder, 'results');
            if (latestDay > 0) {
                select.selectedIndex = latestDay - 1; // Set to latest day (0-indexed)
                loadCSV(folder); // Load the data for the selected day
            }
        }
    }
}

// Function to find the latest available day by checking file existence
async function findLatestDay(folder, type) {
    for (let day = maxDays; day >= 1; day--) {
        let filename;
        if (type === 'mvp') {
            filename = `${mainlineBranch}/${tournament}/data/mvp_day_${day}.csv`;
        } else {
            filename = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_${day}.csv`;
        }
        
        try {
            const response = await fetch(filename, { method: "HEAD" });
            if (response.ok) {
                return day; // Return the latest available day
            }
        } catch (error) {
            // Continue checking previous days
        }
    }
    return 1; // Default to day 1 if no files found
}

// Function to load CSV and check if it exists
async function loadCSV(folder) {
    let select, filename, messageDiv, tableDiv;

    // Set up player tabs
    if (folder === "group_1Players") {
        select = document.getElementById("group_1PlayersSelector");
        filename = select.value;
        messageDiv = document.getElementById("group_1PlayerMessage");
        tableDiv = document.getElementById("group_1PlayerTable");
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
        const response = await fetch(filename, { method: "HEAD" });

        if (!response.ok) throw new Error("File not found");

        messageDiv.textContent = `Loading ${filename}...`;

        // Fetch the CSV data
        const csvResponse = await fetch(filename);
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
        } else if (folder === "group_1Players") {
            // For player groups, use the first row as header, and reverse columns for days
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
        if (folder == "group_1") {
            startIndex = 0
        }
        rows.slice(startIndex).forEach(row => {
            const tr = document.createElement("tr");

            if (folder === "data") {
                // Render MVP data as-is
                row.forEach(cell => {
                    tr.appendChild(createCell(cell));
                });
            } else if (folder === "group_1Players") {
                // For player groups, reverse the order and highlight changes
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
        if (folder === "group_1Players") {
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

        // Create chart for group_1 if applicable
        if (folder === "group_1") {
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
                order: [[2, "desc"]] 
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
        messageDiv.textContent = `File not found: ${filename}. Wait for it to be generated.`;
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

    // Get the URL parameters
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");  // e.g., ?tab=group_1
    const dropdownParam = params.get("dropdown"); // e.g., ?dropdown=day_6

    // Activate the tab if the parameter exists
    if (tabParam) {
        const tabElement = document.querySelector(`[href="#${tabParam}"]`);
        if (tabElement) {
            const tab = new bootstrap.Tab(tabElement);
            tab.show();
            
            // Load data for the activated tab if not already loaded
            if (tabParam === 'group_1') {
                loadCSV(tabParam);
            }
        }
    }

    // Select the dropdown option if the parameter exists
    if (dropdownParam) {
        const dropdowns = document.querySelectorAll("select");
        dropdowns.forEach(select => {
            const option = select.querySelector(`option[value*="${dropdownParam}"]`);
            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event("change")); // Trigger change event if needed
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

    // Get the selected day from dropdown
    const select = document.getElementById(`${folder}Selector`);
    const selectedOption = select.options[select.selectedIndex].text;
    const currentDay = parseInt(selectedOption.replace('Day ', ''));

    // Fetch data from Day 0 to current day
    const allDaysData = [];
    
    for (let day = 0; day <= currentDay; day++) {
        try {
            const filename = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_${day}.csv`;
            const response = await fetch(filename);
            
            if (response.ok) {
                const csvText = await response.text();
                const rows = csvText.split("\n")
                    .map(row => row.trim())
                    .filter(row => row.length > 0)
                    .map(row => row.split(","))
                    .filter(row => row.length > 1 && row[0] && row[0].trim() !== '');
                
                console.log(`Day ${day}: Found ${rows.length - 1} players`); // Debug log
                allDaysData.push({ day, rows });
            }
        } catch (error) {
            console.log(`Day ${day} data not available`);
        }
    }

    if (allDaysData.length === 0) return;

    // Extract player names from the first available day (skip header if it exists)
    const firstDayRows = allDaysData[0].rows;
    // Check if first row is a header by seeing if it has non-numeric values in the points column
    const hasHeader = isNaN(parseFloat(firstDayRows[0][firstDayRows[0].length - 1]));
    const playerNames = hasHeader ? firstDayRows.slice(1).map(row => row[0]) : firstDayRows.map(row => row[0]);

    // Generate colors for each player
    const colors = generateColors(playerNames.length);

    // Build datasets for each player
    const datasets = playerNames.map((playerName, index) => {
        const data = allDaysData.map(dayData => {
            const startIndex = hasHeader ? 1 : 0;
            const playerRow = dayData.rows.slice(startIndex).find(row => row[0] === playerName);
            if (playerRow) {
                // Get the total points (last column)
                return parseFloat(playerRow[playerRow.length - 1]) || 0;
            }
            return 0;
        });

        return {
            label: playerName,
            data: data,
            borderColor: colors[index],
            backgroundColor: colors[index] + '33', // Add transparency
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6
        };
    });

    // Create labels for x-axis
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
    
    // Check if first row is a header
    const hasHeader = isNaN(parseFloat(dayData.rows[0][dayData.rows[0].length - 1]));
    const startIndex = hasHeader ? 1 : 0;
    
    // Get player data for this day
    const players = dayData.rows.slice(startIndex).map(row => ({
        name: row[0],
        points: parseFloat(row[row.length - 1]) || 0
    }));
    
    // Sort by points descending
    players.sort((a, b) => b.points - a.points);
    
    // Calculate position changes if not day 0
    let positionChanges = {};
    if (dayIndex > 0) {
        const prevDayData = allDaysData[dayIndex - 1];
        const prevHasHeader = isNaN(parseFloat(prevDayData.rows[0][prevDayData.rows[0].length - 1]));
        const prevStartIndex = prevHasHeader ? 1 : 0;
        
        const prevPlayers = prevDayData.rows.slice(prevStartIndex).map(row => ({
            name: row[0],
            points: parseFloat(row[row.length - 1]) || 0
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
        statsContainer.className = 'row mt-4 mb-4';
        statsContainer.id = `${folder}DailyStats`;
        
        // Most days at #1 card
        const mostDaysCard = document.createElement('div');
        mostDaysCard.className = 'col-md-3';
        
        let daysText = mostDaysAtRank1 === 1 ? '1 day' : `${mostDaysAtRank1} days`;
        
        mostDaysCard.innerHTML = `
            <div class="card border-primary">
                <div class="card-header bg-primary text-white">
                    <strong>👑 Most Days at #1</strong>
                </div>
                <div class="card-body text-center">
                    <h3 class="text-primary">${mostDaysLeader.join(', ')}</h3>
                    <h4>${daysText}</h4>
                </div>
            </div>
        `;
        
        // Biggest climber card
        const biggestClimberCard = document.createElement('div');
        biggestClimberCard.className = 'col-md-3';
        
        let positionText = maxPositionGain === 1 ? '1 position' : `${maxPositionGain} positions`;
        
        biggestClimberCard.innerHTML = `
            <div class="card border-success">
                <div class="card-header bg-success text-white">
                    <strong>📈 Biggest Climber</strong>
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
        topScorerCard.className = 'col-md-3';
        
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
            <div class="card border-warning">
                <div class="card-header bg-warning text-dark">
                    <strong>🏆 Best Single Day Performance</strong>
                </div>
                <div class="card-body text-center">
                    <h3 class="text-warning">${bestSingleDayPlayer.join(', ')}</h3>
                    <h4>${bestSingleDayPoints.toFixed(1)} points</h4>
                    <p class="mb-2 text-muted">on Day ${bestSingleDayNumber}</p>
                    <p class="mb-0">${durationText}</p>
                </div>
            </div>
        `;
        
        // Daily points table card
        const dailyPointsCard = document.createElement('div');
        dailyPointsCard.className = 'col-md-3';
        
        let dailyPointsHTML = `
            <div class="card">
                <div class="card-header bg-info text-white">
                    <strong>📊 Points Scored on Day ${currentDay}</strong>
                </div>
                <div class="card-body">
                    <table class="table table-sm table-hover">
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
        `;
        
        dailyPointsCard.innerHTML = dailyPointsHTML;
        
        // Add cards to container
        statsContainer.appendChild(mostDaysCard);
        statsContainer.appendChild(biggestClimberCard);
        statsContainer.appendChild(topScorerCard);
        statsContainer.appendChild(dailyPointsCard);
        
        // Insert before the table
        tableDiv.parentNode.insertBefore(statsContainer, tableDiv);
        
    } catch (error) {
        console.error('Error calculating daily points:', error);
    }
}
